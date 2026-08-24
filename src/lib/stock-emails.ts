import "server-only";

import { sendMail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { SITE_TITLE, SITE_URL } from "@/lib/site";

/**
 * Telling the shop that something is running out.
 *
 * Sent on the *crossing* and nowhere else: the sale that takes a product from
 * above its threshold to at or below it. Sending on every sale after that
 * would be a message a day about the same six products, which is the fastest
 * way to make people filter the alerts into a folder they never open.
 *
 * It goes to the people who run the shop rather than to its public address.
 * `contactEmail` is where customers write; a request to reorder is not a
 * customer's business, and a small shop's public inbox is often somebody's
 * phone. Admins are read at the moment of sending, so somebody added last week
 * gets the next one.
 *
 * This is the shop's own copy, so it is in English only. Every other message
 * this project sends is written in the reader's language because the reader
 * chose one; here the reader is whoever is on the admin list, and there is no
 * such choice to read.
 */

export type LowStockItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
};

/** Every enabled admin. The last-admin rule means this is never empty. */
async function shopkeepers(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "admin", disabledAt: null },
    select: { email: true },
  });
  return admins.map((admin) => admin.email).filter((email) => email.length > 0);
}

export async function sendLowStockEmail(items: LowStockItem[]): Promise<void> {
  if (items.length === 0) return;

  const to = await shopkeepers();
  if (to.length === 0) return;

  const subject =
    items.length === 1
      ? `Low stock: ${items[0]!.name} — ${SITE_TITLE}`
      : `Low stock: ${items.length} products — ${SITE_TITLE}`;

  const lines = items.map(
    (item) => `• ${item.name} (${item.sku}) — ${item.stock} left, alert at ${item.threshold}`,
  );

  const links = items.map((item) => `${SITE_URL}/dashboard/products/${item.id}`);

  const text = [
    "These products have fallen to their low-stock threshold:",
    "",
    ...lines,
    "",
    ...links,
  ].join("\n");

  const html = [
    `<p style="margin:0 0 12px">These products have fallen to their low-stock threshold:</p>`,
    "<ul style=\"margin:0 0 12px;padding-left:18px\">",
    ...items.map(
      (item) =>
        `<li style="margin:0 0 6px"><a href="${SITE_URL}/dashboard/products/${item.id}">${escapeHtml(item.name)}</a>` +
        ` (${escapeHtml(item.sku)}) — <strong>${item.stock}</strong> left, alert at ${item.threshold}</li>`,
    ),
    "</ul>",
  ].join("");

  /* One message per recipient rather than one with everybody in `to`: a shop's
     admin list is not a mailing list its members agreed to be on, and putting
     their addresses in each other's headers would say who else works here. */
  await Promise.all(to.map((address) => sendMail({ to: address, subject, text, html })));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
