import "server-only";

import { sendMail } from "@/lib/mail";
import { SITE_TITLE, SITE_URL } from "@/lib/site";
import type { Locale } from "@/lib/i18n";
import type { ReturnStatus } from "@/lib/returns";

/**
 * The shop's answer to a return request, sent to the shopper who asked.
 *
 * Separate from `order-emails.ts` because the shape is different again: no
 * line-item table and no total, one sentence about what the shop decided, the
 * shop's own words if it wrote any, and a link to the order page where the
 * request lives. As there, copy sits here rather than in `i18n.ts` — it is
 * never rendered in the UI — and every message has a plain-text twin.
 *
 * Nothing is sent for `requested`: that is the shopper's own action, and a
 * confirmation of it is the page they are already looking at.
 */

export type ReturnMailInput = {
  to: string;
  number: string;
  status: Exclude<ReturnStatus, "requested">;
  /** The staff reply, shown verbatim when there is one. */
  staffNote: string;
  locale: Locale;
};

const COPY = {
  ka: {
    subject: "დაბრუნების მოთხოვნა",
    heading: {
      approved: "დაბრუნება დამტკიცებულია",
      rejected: "დაბრუნების მოთხოვნა არ დადასტურდა",
      received: "პროდუქტი მივიღეთ",
      refunded: "თანხა დაბრუნებულია",
    },
    body: {
      approved: "გამოგზავნე პროდუქტი ან მოიტანე მაღაზიაში. როცა მივიღებთ, აქვე შეგატყობინებთ.",
      rejected: "მაღაზიამ ეს მოთხოვნა ვერ დაადასტურა. მიზეზი, თუ დაწერეს, ქვემოთაა.",
      received: "დაბრუნებული პროდუქტი მაღაზიაშია. თანხის დაბრუნებას ახლა ვიწყებთ.",
      refunded: "თანხა იმავე გზით დაბრუნდა, რითაც გადაიხადე.",
    },
    reply: "მაღაზიის პასუხი",
    orderNumber: "შეკვეთის ნომერი",
    open: "შეკვეთის ნახვა",
    footer: "ეს წერილი გამოგზავნილია ავტომატურად.",
  },
  en: {
    subject: "Your return request",
    heading: {
      approved: "Your return is approved",
      rejected: "Your return request was not accepted",
      received: "We have received the item",
      refunded: "Your money has been returned",
    },
    body: {
      approved: "Send the item back or bring it to the shop. We will let you know here when it arrives.",
      rejected: "The shop could not accept this request. If it gave a reason, it is below.",
      received: "The returned item is back at the shop. The refund is being arranged now.",
      refunded: "The money has gone back the way it was paid.",
    },
    reply: "The shop's reply",
    orderNumber: "Order number",
    open: "Open the order",
    footer: "This message was sent automatically.",
  },
} satisfies Record<Locale, unknown>;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendReturnUpdateEmail(input: ReturnMailInput): Promise<boolean> {
  // Email is optional at checkout, and an order placed without one has
  // nobody to write to. Not a failure.
  if (!input.to) return false;

  const t = COPY[input.locale];
  const heading = t.heading[input.status];
  const body = t.body[input.status];
  const orderUrl = `${SITE_URL}/order/${encodeURIComponent(input.number)}`;
  const note = input.staffNote.trim();

  const text = [
    heading,
    "",
    body,
    ...(note ? ["", `${t.reply}:`, note] : []),
    "",
    `${t.orderNumber}: ${input.number}`,
    `${t.open}: ${orderUrl}`,
    "",
    t.footer,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#de1f24;">${escapeHtml(SITE_TITLE)}</p>
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1c1917;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(body)}</p>
      ${
        note
          ? `<div style="margin:0 0 20px;padding:12px 14px;background:#f5f5f4;border-radius:9px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#78716c;">${escapeHtml(t.reply)}</p>
        <p style="margin:0;font-size:14px;line-height:1.55;color:#1c1917;white-space:pre-line;">${escapeHtml(note)}</p>
      </div>`
          : ""
      }
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e7e5e4;">
        <tr>
          <td style="padding:10px 0 2px;font-size:13px;color:#78716c;">${escapeHtml(t.orderNumber)}</td>
          <td style="padding:10px 0 2px;font-size:13px;color:#1c1917;text-align:right;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(input.number)}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(orderUrl)}"
           style="display:inline-block;background:#de1f24;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:9px;font-size:14px;font-weight:700;">
          ${escapeHtml(t.open)}
        </a>
      </p>
      <p style="margin:20px 0 0;font-size:12px;color:#a8a29e;">${escapeHtml(t.footer)}</p>
    </div>
  </body>
</html>`;

  return sendMail({
    to: input.to,
    subject: `${t.subject} ${input.number} — ${SITE_TITLE}`,
    text,
    html,
  });
}
