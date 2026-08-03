import "server-only";

import { prisma } from "@/lib/prisma";

export type CouponCheck =
  | { ok: true; id: string; code: string; discount: number }
  | { ok: false; reason: "not-found" | "expired" | "used-up" | "min-total" };

/**
 * Validates a code against an order subtotal and works out the discount.
 *
 * `subtotal` and the returned `discount` are both in tetri.
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

  // Everything here is tetri. The percentage is the only division, and it is
  // rounded straight back to a whole tetri — so the discount can never carry a
  // fraction into the order total.
  const raw = coupon.percentOff
    ? Math.round((subtotal * coupon.percentOff) / 100)
    : (coupon.amountOff ?? 0);

  // Never more than the basket itself, or the shop pays the customer.
  const discount = Math.min(raw, subtotal);

  return { ok: true, id: coupon.id, code: coupon.code, discount };
}
