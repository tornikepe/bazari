import "server-only";

import { sendMail } from "@/lib/mail";
import { SITE_TITLE, SITE_URL } from "@/lib/site";

/**
 * "You left these in your cart", the day after.
 *
 * One message, once, with what was in the cart and the way back to it. No
 * discount attached: a reminder that always comes with ten percent off
 * teaches every shopper to abandon their cart on purpose.
 *
 * Bilingual in one message rather than in the shopper's language, because
 * the cart snapshot does not record which one they were reading in and the
 * message is short enough to carry both.
 */

export type AbandonedCartMailInput = {
  to: string;
  items: { nameKa: string; nameEn: string; quantity: number; slug: string }[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendAbandonedCartEmail(input: AbandonedCartMailInput): Promise<boolean> {
  if (!input.to || input.items.length === 0) return false;

  const cartUrl = `${SITE_URL}/cart`;
  const lines = input.items.map((item) => `  ${item.nameKa} / ${item.nameEn} × ${item.quantity}`);

  const text = [
    "კალათაში რაღაც დაგრჩა · Something is still in your cart",
    "",
    "გუშინ კალათაში ეს პროდუქტები დატოვე. ისინი ისევ იქ არის.",
    "You left these in your cart yesterday. They are still there.",
    "",
    ...lines,
    "",
    `კალათის გახსნა · Open your cart: ${cartUrl}`,
    "",
    "ეს წერილი გამოგზავნილია ავტომატურად, ერთხელ. · Sent automatically, once.",
  ].join("\n");

  const rows = input.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;font-size:14px;color:#44403c;">${escapeHtml(item.nameKa)}<br><span style="color:#78716c;">${escapeHtml(item.nameEn)}</span></td><td style="padding:6px 0;font-size:14px;color:#1c1917;text-align:right;white-space:nowrap;">× ${item.quantity}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px;">
      <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:#de1f24;">${escapeHtml(SITE_TITLE)}</p>
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#1c1917;">კალათაში რაღაც დაგრჩა</h1>
      <p style="margin:0 0 12px;font-size:15px;color:#78716c;">Something is still in your cart</p>
      <p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#44403c;">გუშინ კალათაში ეს პროდუქტები დატოვე. ისინი ისევ იქ არის.</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#78716c;">You left these in your cart yesterday. They are still there.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;border-top:1px solid #e7e5e4;">${rows}</table>
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(cartUrl)}" style="display:inline-block;background:#de1f24;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:9px;font-size:14px;font-weight:700;">კალათის გახსნა · Open your cart</a>
      </p>
      <p style="margin:20px 0 0;font-size:12px;color:#a8a29e;">ეს წერილი გამოგზავნილია ავტომატურად, ერთხელ. · Sent automatically, once.</p>
    </div>
  </body>
</html>`;

  return sendMail({
    to: input.to,
    subject: `კალათაში რაღაც დაგრჩა · Something is still in your cart — ${SITE_TITLE}`,
    text,
    html,
  });
}
