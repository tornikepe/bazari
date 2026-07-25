"use server";

import { prisma } from "@/lib/prisma";

/**
 * Looks up an order for the storefront tracking page.
 *
 * The order number alone is not a secret worth much, so the phone number is
 * required as a second factor — otherwise anyone could enumerate order numbers
 * and read customers' names and addresses. Only the status is returned, never
 * the customer's details.
 */
export type TrackResult =
  | { ok: true; number: string; status: string; total: number; createdAt: string; itemCount: number }
  | { ok: false; error: "not-found" | "invalid" };

export async function trackOrder(orderNumber: string, phone: string): Promise<TrackResult> {
  const number = orderNumber.trim().toUpperCase();
  const digits = phone.replace(/\D/g, "");

  if (!number || digits.length < 9) return { ok: false, error: "invalid" };

  const order = await prisma.order.findUnique({
    where: { number },
    select: {
      number: true,
      phone: true,
      status: true,
      total: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });

  // Compare digits only — the stored number may carry spaces or a +995 prefix.
  if (!order || !order.phone.replace(/\D/g, "").endsWith(digits.slice(-9))) {
    return { ok: false, error: "not-found" };
  }

  return {
    ok: true,
    number: order.number,
    status: order.status,
    total: order.total,
    createdAt: order.createdAt.toISOString(),
    itemCount: order._count.items,
  };
}
