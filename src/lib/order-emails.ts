import "server-only";

import { sendMail } from "@/lib/mail";
import { SITE_TITLE, SITE_URL } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/**
 * Order lifecycle mail.
 *
 * Separate from `auth-emails.ts` because the shape is different: these carry a
 * line-item table and a tracking link rather than a single code. As there,
 * copy lives here instead of `i18n.ts` — it is never rendered in the UI, and
 * every message needs a plain-text twin.
 */

type Line = { nameKa: string; nameEn: string; quantity: number; price: number };

export type OrderMailInput = {
  to: string;
  number: string;
  total: number;
  items: Line[];
  locale: Locale;
};

const COPY = {
  ka: {
    placedSubject: "შეკვეთა მიღებულია",
    placedHeading: "შეკვეთა მიღებულია",
    placedBody: "მადლობა შეკვეთისთვის. ოპერატორი უახლოეს საათებში დაგიკავშირდება.",
    shippedSubject: "შეკვეთა გზაშია",
    shippedHeading: "შეკვეთა გზაშია",
    shippedBody: "შენი შეკვეთა კურიერს გადაეცა.",
    orderNumber: "შეკვეთის ნომერი",
    total: "ჯამი",
    track: "შეკვეთის სტატუსის ნახვა",
    footer: "ეს წერილი გამოგზავნილია ავტომატურად.",
  },
  en: {
    placedSubject: "Order received",
    placedHeading: "Order received",
    placedBody: "Thanks for your order. We'll be in touch within a few hours.",
    shippedSubject: "Your order is on its way",
    shippedHeading: "Your order is on its way",
    shippedBody: "Your order has been handed to the courier.",
    orderNumber: "Order number",
    total: "Total",
    track: "Track your order",
    footer: "This message was sent automatically.",
  },
} satisfies Record<Locale, Record<string, string>>;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(opts: {
  heading: string;
  body: string;
  number: string;
  total: string;
  items: string;
  trackUrl: string;
  trackLabel: string;
  numberLabel: string;
  totalLabel: string;
  footer: string;
}) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#de1f24;">${escapeHtml(SITE_TITLE)}</p>
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1c1917;">${escapeHtml(opts.heading)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(opts.body)}</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${opts.items}
      </table>

      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e7e5e4;padding-top:8px;">
        <tr>
          <td style="padding:10px 0 2px;font-size:13px;color:#78716c;">${escapeHtml(opts.numberLabel)}</td>
          <td style="padding:10px 0 2px;font-size:13px;color:#1c1917;text-align:right;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(opts.number)}</td>
        </tr>
        <tr>
          <td style="padding:2px 0;font-size:15px;font-weight:700;color:#1c1917;">${escapeHtml(opts.totalLabel)}</td>
          <td style="padding:2px 0;font-size:15px;font-weight:800;color:#1c1917;text-align:right;">${escapeHtml(opts.total)}</td>
        </tr>
      </table>

      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(opts.trackUrl)}"
           style="display:inline-block;background:#de1f24;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:9px;font-size:14px;font-weight:700;">
          ${escapeHtml(opts.trackLabel)}
        </a>
      </p>

      <p style="margin:20px 0 0;font-size:12px;color:#a8a29e;">${escapeHtml(opts.footer)}</p>
    </div>
  </body>
</html>`;
}

function renderItems(items: Line[], locale: Locale) {
  const html = items
    .map((item) => {
      const name = escapeHtml(locale === "ka" ? item.nameKa : item.nameEn);
      const money = escapeHtml(formatPrice(item.price * item.quantity, locale));
      return `<tr>
          <td style="padding:6px 0;font-size:14px;color:#44403c;">${name} × ${item.quantity}</td>
          <td style="padding:6px 0;font-size:14px;color:#1c1917;text-align:right;white-space:nowrap;">${money}</td>
        </tr>`;
    })
    .join("\n        ");

  const text = items
    .map(
      (item) =>
        `  ${locale === "ka" ? item.nameKa : item.nameEn} × ${item.quantity} — ${formatPrice(
          item.price * item.quantity,
          locale,
        )}`,
    )
    .join("\n");

  return { html, text };
}

async function send(input: OrderMailInput, kind: "placed" | "shipped") {
  // Email is optional at checkout — a guest who left it blank simply gets no
  // mail, which must not be treated as a failure.
  if (!input.to) return false;

  const t = COPY[input.locale];
  const heading = kind === "placed" ? t.placedHeading : t.shippedHeading;
  const body = kind === "placed" ? t.placedBody : t.shippedBody;
  const subject = kind === "placed" ? t.placedSubject : t.shippedSubject;

  const trackUrl = `${SITE_URL}/track?number=${encodeURIComponent(input.number)}`;
  const items = renderItems(input.items, input.locale);
  const total = formatPrice(input.total, input.locale);

  return sendMail({
    to: input.to,
    subject: `${subject} ${input.number} — ${SITE_TITLE}`,
    text: [
      heading,
      "",
      body,
      "",
      items.text,
      "",
      `${t.orderNumber}: ${input.number}`,
      `${t.total}: ${total}`,
      "",
      `${t.track}: ${trackUrl}`,
      "",
      t.footer,
    ].join("\n"),
    html: layout({
      heading,
      body,
      number: input.number,
      total,
      items: items.html,
      trackUrl,
      trackLabel: t.track,
      numberLabel: t.orderNumber,
      totalLabel: t.total,
      footer: t.footer,
    }),
  });
}

export const sendOrderPlacedEmail = (input: OrderMailInput) => send(input, "placed");
export const sendOrderShippedEmail = (input: OrderMailInput) => send(input, "shipped");
