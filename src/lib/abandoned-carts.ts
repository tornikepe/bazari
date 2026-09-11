import "server-only";

import { prisma } from "@/lib/prisma";
import { productCardSelect } from "@/lib/catalog";
import { sendAbandonedCartEmail } from "@/lib/cart-emails";
import { isDueForReminder, type CartLine } from "@/lib/abandoned-cart-rules";

export type { CartLine };

/** Never more than this from one browser; a cart is not a spreadsheet. */
const MAX_LINES = 50;

function clean(items: unknown): CartLine[] {
  if (!Array.isArray(items)) return [];
  const lines: CartLine[] = [];
  for (const item of items) {
    if (typeof item?.productId !== "string" || !item.productId) continue;
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    lines.push({
      productId: item.productId,
      ...(typeof item.variantId === "string" && item.variantId ? { variantId: item.variantId } : {}),
      quantity,
    });
    if (lines.length >= MAX_LINES) break;
  }
  return lines;
}

/**
 * Replaces a customer's snapshot with what the browser has now, or removes it
 * when the browser has nothing. An emptied cart is not an abandoned one.
 */
export async function saveSnapshot(userId: string, items: unknown): Promise<void> {
  const lines = clean(items);
  if (lines.length === 0) {
    await prisma.cartSnapshot.deleteMany({ where: { userId } });
    return;
  }
  await prisma.cartSnapshot.upsert({
    where: { userId },
    // A new snapshot is a new cart: the reminder clock starts again, and a
    // cart reminded about last week may be reminded about once more if it
    // was changed since — that is a different cart.
    create: { userId, items: lines },
    update: { items: lines, remindedAt: null },
  });
}

/**
 * Writes to everyone whose cart has sat untouched for a day.
 *
 * Once per cart, never to a customer who ordered since, and never about a
 * cart older than a week — a message about something from last month is
 * not a reminder, it is a nag. Products that have gone since are left out
 * of the message, and a cart with nothing left in it gets none.
 */
export async function remindAbandonedCarts(now = new Date()): Promise<{ reminded: number }> {
  const candidates = await prisma.cartSnapshot.findMany({
    where: { remindedAt: null },
    include: {
      user: {
        select: {
          email: true,
          role: true,
          disabledAt: true,
          orders: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        },
      },
    },
  });

  let reminded = 0;
  for (const snapshot of candidates) {
    if (snapshot.user.role !== "customer" || snapshot.user.disabledAt) continue;
    if (!isDueForReminder(snapshot, snapshot.user.orders[0]?.createdAt ?? null, now)) continue;

    const lines = clean(snapshot.items);
    const products = await prisma.product.findMany({
      where: { id: { in: lines.map((line) => line.productId) }, isActive: true },
      select: productCardSelect,
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    const items = lines.flatMap((line) => {
      const product = byId.get(line.productId);
      return product
        ? [{ nameKa: product.nameKa, nameEn: product.nameEn, quantity: line.quantity, slug: product.slug }]
        : [];
    });

    // Marked before the send, not after: a provider that answers slowly and
    // a second sweep that starts meanwhile must not both write.
    await prisma.cartSnapshot.update({
      where: { userId: snapshot.userId },
      data: { remindedAt: now },
    });

    if (items.length === 0) continue;
    const sent = await sendAbandonedCartEmail({ to: snapshot.user.email, items }).catch((error) => {
      console.error("sendAbandonedCartEmail failed", error);
      return false;
    });
    if (sent) reminded += 1;
  }

  return { reminded };
}
