import "server-only";

import { getSettings } from "@/lib/settings";

/**
 * Outgoing mail.
 *
 * Deliberately provider-agnostic and dependency-free: it posts to the Resend
 * REST API when `RESEND_API_KEY` is set, and swapping providers means changing
 * only `deliver()` below.
 *
 * When no key is configured the message is written to the *server* log and
 * nothing is returned to the browser. That keeps local development workable
 * without ever handing a one-time code to the caller — the mistake this module
 * exists to fix.
 */

export type MailInput = {
  to: string;
  subject: string;
  /** Plain text is required; some clients never render the HTML part. */
  text: string;
  html: string;
  /** Files to go with it — an invoice. Kept small: mail is not a file store. */
  attachments?: { filename: string; content: Buffer; contentType: string }[];
};

const API_URL = "https://api.resend.com/emails";

/**
 * Whether this deployment can send mail at all.
 *
 * Asked by the pages that would otherwise tell a visitor to check an inbox
 * nothing was sent to. It is deliberately about *configuration* and never
 * about a particular address: "we cannot send email" is safe to say to
 * anybody, where "we did not send to you" would answer a question about who
 * has an account here.
 */
export function mailConfigured(): boolean {
  return readApiKey() !== undefined;
}

/**
 * Whether a staff sign-in takes a second step: the password, then a code
 * sent to the address on the account.
 *
 * Off unless the deployment asks for it, and that default is deliberate.
 * When this was keyed on nothing but "can the shop send email", setting a
 * mail key switched it on everywhere at once — and the owner's own account
 * is `admin@` on a domain the shop does not receive mail at, so the code
 * went somewhere nobody reads and the dashboard locked its owner out of it.
 * Turning a second factor on is a decision about who can reach the address,
 * not a side effect of configuring a mailer.
 *
 * It still needs a mailer: without one there is no code to send, and
 * insisting on one would lock the door and throw away the key.
 */
export function staffTwoStep(): boolean {
  return process.env.STAFF_2FA === "1" && mailConfigured();
}

/**
 * The API key, tolerant of a fumbled copy-paste.
 *
 * Pasting into `vercel env add` easily picks up a trailing newline, or the
 * value twice. Either makes the `Authorization` header outright invalid and
 * `fetch` throws before any request is sent, so take the first whitespace-
 * delimited token and warn loudly rather than failing on every send.
 */
function readApiKey(): string | undefined {
  const raw = process.env.RESEND_API_KEY;
  if (!raw) return undefined;

  const first = raw.trim().split(/\s+/)[0];
  if (!first) return undefined;

  if (first !== raw.trim()) {
    console.warn(
      "[mail] RESEND_API_KEY contained whitespace or repeated content — using the first token. Re-add it as a single line.",
    );
  }

  return first;
}

async function fromAddress() {
  // A verified sender on your own domain. Resend's shared `onboarding@resend.dev`
  // only delivers to the account owner, so it is fine for a first smoke test
  // but not for real customers.
  // `||`, not `??`: an env var that exists but is empty must still fall back,
  // otherwise the provider rejects the message for a blank sender.
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;

  /* The display name is the shop's own, so a smoke test before a domain is
     verified still arrives from the shop rather than from whatever this
     project was called when it was written. */
  const { name } = await getSettings();
  const display = name.replace(/["\\<>]/g, "").trim() || "Shop";
  return `${display} <onboarding@resend.dev>`;
}

/**
 * Sends a message. Never throws — callers must not vary their response based
 * on delivery, or the endpoint turns into an account-enumeration oracle.
 *
 * @returns whether the provider accepted the message.
 */
export async function sendMail(input: MailInput): Promise<boolean> {
  const apiKey = readApiKey();

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[mail] RESEND_API_KEY is not set — "${input.subject}" to ${input.to} was NOT sent.`,
      );
      return false;
    }

    // Local development: the developer reads this from their own terminal.
    const attached = (input.attachments ?? [])
      .map((file) => `       attached: ${file.filename} (${Math.round(file.content.byteLength / 1024)} KB)`)
      .join("\n");
    console.info(
      `\n[mail] no RESEND_API_KEY — would have sent to ${input.to}\n` +
        `       subject: ${input.subject}\n` +
        `${input.text.replace(/^/gm, "       ")}\n` +
        (attached ? `${attached}\n` : ""),
    );
    return true;
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: await fromAddress(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
        // The provider takes the bytes base64-encoded in the JSON body.
        ...(input.attachments && input.attachments.length > 0
          ? {
              attachments: input.attachments.map((file) => ({
                filename: file.filename,
                content: file.content.toString("base64"),
                content_type: file.contentType,
              })),
            }
          : {}),
      }),
    });

    if (!response.ok) {
      // Body may carry the provider's reason (unverified domain, bad key…).
      console.error(`[mail] provider rejected the message: ${response.status}`, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[mail] delivery failed", error);
    return false;
  }
}
