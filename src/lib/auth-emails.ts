import "server-only";

import { sendMail } from "@/lib/mail";
import { SITE_TITLE } from "@/lib/site";
import type { Locale } from "@/lib/i18n";

/**
 * The two one-time-code emails.
 *
 * Copy lives here rather than in `i18n.ts` because it is never rendered in the
 * UI, and email needs its own tone and a plain-text twin of every message.
 */

const COPY = {
  ka: {
    verifySubject: "დაადასტურე ელფოსტა",
    verifyHeading: "დაადასტურე ელფოსტა",
    verifyBody: "შენი დასადასტურებელი კოდია:",
    resetSubject: "პაროლის აღდგენა",
    resetHeading: "პაროლის აღდგენა",
    resetBody: "პაროლის შესაცვლელი კოდია:",
    expires: "კოდი 15 წუთის განმავლობაში მოქმედებს.",
    ignore: "თუ ეს შენ არ მოგითხოვია, უბრალოდ იგნორირება გაუკეთე ამ წერილს.",
  },
  en: {
    verifySubject: "Confirm your email",
    verifyHeading: "Confirm your email",
    verifyBody: "Your confirmation code is:",
    resetSubject: "Reset your password",
    resetHeading: "Reset your password",
    resetBody: "Your password reset code is:",
    expires: "The code is valid for 15 minutes.",
    ignore: "If you didn't request this, you can safely ignore this email.",
  },
} satisfies Record<Locale, Record<string, string>>;

/** Minimal, table-free layout — it renders predictably in every client. */
function wrap(heading: string, body: string, code: string, footer: string[]) {
  const escaped = code.replace(/[^0-9A-Za-z]/g, "");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#de1f24;">${SITE_TITLE}</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1c1917;">${heading}</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#44403c;">${body}</p>
      <p style="margin:0 0 20px;font-size:30px;font-weight:800;letter-spacing:6px;color:#1c1917;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escaped}</p>
      ${footer
        .map(
          (line) =>
            `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#78716c;">${line}</p>`,
        )
        .join("\n      ")}
    </div>
  </body>
</html>`;
}

function plain(heading: string, body: string, code: string, footer: string[]) {
  return [heading, "", body, "", code, "", ...footer].join("\n");
}

export async function sendVerificationEmail(to: string, code: string, locale: Locale) {
  const t = COPY[locale];
  const footer = [t.expires, t.ignore];

  return sendMail({
    to,
    subject: `${t.verifySubject} — ${SITE_TITLE}`,
    text: plain(t.verifyHeading, t.verifyBody, code, footer),
    html: wrap(t.verifyHeading, t.verifyBody, code, footer),
  });
}

export async function sendPasswordResetEmail(to: string, code: string, locale: Locale) {
  const t = COPY[locale];
  const footer = [t.expires, t.ignore];

  return sendMail({
    to,
    subject: `${t.resetSubject} — ${SITE_TITLE}`,
    text: plain(t.resetHeading, t.resetBody, code, footer),
    html: wrap(t.resetHeading, t.resetBody, code, footer),
  });
}
