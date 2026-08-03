import "server-only";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readReceipts } from "@/lib/order-access";
import { formatDate, formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/**
 * The one tool that touches customer data — and the reason this file is
 * separate from `retrieval.ts`.
 *
 * The assistant never chooses whose order it reads. It passes an order number;
 * this module decides, from the request's own cookies, whether the person
 * typing is entitled to see it. Two proofs of ownership are accepted, the same
 * two `/order/[number]` accepts:
 *
 *   1. A signed-in account that the order belongs to.
 *   2. The signed `bz_receipts` cookie, which `placeOrder` writes to the
 *      browser that placed the order — this is how a guest checkout can see
 *      its own confirmation without an account.
 *
 * Unlike that page, an admin session grants **nothing** here. Staff have the
 * dashboard; there is no reason for a chat transcript to become a second way
 * to read arbitrary customers' addresses.
 *
 * A number that exists but isn't yours is reported exactly like one that
 * doesn't exist. Distinguishing them would turn the chat into an oracle for
 * which order numbers are real.
 *
 * Read-only by construction: the only Prisma call below is a `findFirst`.
 * Nothing in the chat path can change an order, cancel one, or move money.
 */

export type OrderLookupResult =
  | { found: false }
  | {
      found: true;
      number: string;
      status: string;
      paymentStatus: string;
      paymentMethod: string;
      placedOn: string;
      shippedOn: string | null;
      deliveredOn: string | null;
      city: string;
      total: string;
      itemCount: number;
      items: { name: string; quantity: number; price: string }[];
      url: string;
    };

export async function lookupOrder(
  orderNumber: string,
  locale: Locale,
): Promise<OrderLookupResult> {
  const number = orderNumber.trim().toUpperCase();
  if (!number) return { found: false };

  const [user, receipts] = await Promise.all([getCurrentUser(), readReceipts()]);

  // The ownership test is part of the query, not a check afterwards: an order
  // the caller doesn't own is never loaded into memory in the first place.
  const owned: { userId?: string; number?: { in: string[] } }[] = [];
  if (user) owned.push({ userId: user.id });
  if (receipts.length) owned.push({ number: { in: receipts } });
  if (owned.length === 0) return { found: false };

  const order = await prisma.order.findFirst({
    where: { number, OR: owned },
    select: {
      number: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      createdAt: true,
      shippedAt: true,
      deliveredAt: true,
      city: true,
      total: true,
      items: {
        select: { nameKa: true, nameEn: true, quantity: true, price: true },
      },
    },
  });

  if (!order) return { found: false };

  return {
    found: true,
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    placedOn: formatDate(order.createdAt),
    shippedOn: order.shippedAt ? formatDate(order.shippedAt) : null,
    deliveredOn: order.deliveredAt ? formatDate(order.deliveredAt) : null,
    city: order.city,
    total: formatPrice(order.total, locale),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.map((item) => ({
      name: locale === "ka" ? item.nameKa : item.nameEn,
      quantity: item.quantity,
      price: formatPrice(item.price, locale),
    })),
    url: `/order/${encodeURIComponent(order.number)}`,
  };
}

/**
 * Whether the caller has any order the assistant could look up.
 *
 * Used to word the prompt: with nothing to look up, "give me your order
 * number" is a dead end, and the right answer is to point at `/track`.
 */
export async function callerHasOrders(): Promise<boolean> {
  const [user, receipts] = await Promise.all([getCurrentUser(), readReceipts()]);
  if (receipts.length > 0) return true;
  if (!user) return false;

  const count = await prisma.order.count({ where: { userId: user.id } });
  return count > 0;
}
