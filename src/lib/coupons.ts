import "server-only";

import { prisma } from "@/lib/prisma";

export type CouponCheck =
  | { ok: true; id: string; code: string; discount: number }
  | { ok: false; reason: "not-found" | "expired" | "used-up" | "min-total" };

/**
 * Validates a code against an order subtotal and works out the discount.
 *
 * Shared by the checkout preview and `placeOrder`, so the amount the customer
 * is shown and the amount actually charged come from the same code path — the
 * discount is never taken from the request body.
 */
export async function checkCoupon(rawCode: string, subtotal: number): Promise<CouponCheck> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, reason: "not-found" };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) return { ok: false, reason: "not-found" };

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: "used-up" };
  }

  if (subtotal < coupon.minOrderTotal) {
    return { ok: false, reason: "min-total" };
  }

  const raw = coupon.percentOff
    ? (subtotal * coupon.percentOff) / 100
    : (coupon.amountOff ?? 0);

  // Never discount below zero, and round to whole tetri.
  const discount = Math.round(Math.min(raw, subtotal) * 100) / 100;

  return { ok: true, id: coupon.id, code: coupon.code, discount };
}
