import "server-only";

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
};

const API_URL = "https://api.resend.com/emails";

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

function fromAddress() {
  // A verified sender on your own domain. Resend's shared `onboarding@resend.dev`
  // only delivers to the account owner, so it is fine for a first smoke test
  // but not for real customers.
  // `||`, not `??`: an env var that exists but is empty must still fall back,
  // otherwise the provider rejects the message for a blank sender.
  return process.env.MAIL_FROM || "Bazari <onboarding@resend.dev>";
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
    console.info(
      `\n[mail] no RESEND_API_KEY — would have sent to ${input.to}\n` +
        `       subject: ${input.subject}\n` +
        `${input.text.replace(/^/gm, "       ")}\n`,
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
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
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
