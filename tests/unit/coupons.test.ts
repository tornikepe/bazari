import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * `checkCoupon` decides what a customer is charged, so every branch is worth a
 * test. The Prisma client is mocked rather than hit: this is about the maths
 * and the rules, not the database.
 */
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { coupon: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

const { checkCoupon } = await import("@/lib/coupons");

type CouponRow = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOff: number | null;
  minOrderTotal: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  expiresAt: Date | null;
};

function coupon(overrides: Partial<CouponRow> = {}): CouponRow {
  return {
    id: "c1",
    code: "SAVE10",
    percentOff: 10,
    amountOff: null,
    minOrderTotal: 0,
    maxUses: null,
    usedCount: 0,
    isActive: true,
    expiresAt: null,
    ...overrides,
  };
}

beforeEach(() => findUnique.mockReset());

describe("checkCoupon", () => {
  it("takes a percentage off the subtotal", async () => {
    findUnique.mockResolvedValue(coupon({ percentOff: 25 }));

    const result = await checkCoupon("SAVE10", 20_000);

    expect(result).toEqual({ ok: true, id: "c1", code: "SAVE10", discount: 5_000 });
  });

  it("takes a fixed amount off", async () => {
    findUnique.mockResolvedValue(coupon({ percentOff: null, amountOff: 1_500 }));

    const result = await checkCoupon("SAVE10", 20_000);

    expect(result).toMatchObject({ ok: true, discount: 1_500 });
  });

  it("upper-cases and trims the code before looking it up", async () => {
    findUnique.mockResolvedValue(coupon());

    await checkCoupon("  save10  ", 10_000);

    expect(findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } });
  });

  it("rejects an empty code without querying", async () => {
    const result = await checkCoupon("   ", 10_000);

    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rejects a code that does not exist", async () => {
    findUnique.mockResolvedValue(null);

    expect(await checkCoupon("NOPE", 10_000)).toEqual({ ok: false, reason: "not-found" });
  });

  it("treats a deactivated coupon as non-existent, not as a distinct error", async () => {
    findUnique.mockResolvedValue(coupon({ isActive: false }));

    expect(await checkCoupon("SAVE10", 10_000)).toEqual({ ok: false, reason: "not-found" });
  });

  it("rejects an expired coupon", async () => {
    findUnique.mockResolvedValue(coupon({ expiresAt: new Date(Date.now() - 1000) }));

    expect(await checkCoupon("SAVE10", 10_000)).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts one expiring in the future", async () => {
    findUnique.mockResolvedValue(coupon({ expiresAt: new Date(Date.now() + 60_000) }));

    expect(await checkCoupon("SAVE10", 10_000)).toMatchObject({ ok: true });
  });

  it("rejects a coupon that has hit its usage cap", async () => {
    findUnique.mockResolvedValue(coupon({ maxUses: 5, usedCount: 5 }));

    expect(await checkCoupon("SAVE10", 10_000)).toEqual({ ok: false, reason: "used-up" });
  });

  it("allows the final use", async () => {
    findUnique.mockResolvedValue(coupon({ maxUses: 5, usedCount: 4 }));

    expect(await checkCoupon("SAVE10", 10_000)).toMatchObject({ ok: true });
  });

  it("rejects a subtotal below the minimum", async () => {
    findUnique.mockResolvedValue(coupon({ minOrderTotal: 10_000 }));

    expect(await checkCoupon("SAVE10", 9_999)).toEqual({ ok: false, reason: "min-total" });
  });

  it("accepts a subtotal exactly at the minimum", async () => {
    findUnique.mockResolvedValue(coupon({ minOrderTotal: 10_000 }));

    expect(await checkCoupon("SAVE10", 10_000)).toMatchObject({ ok: true });
  });

  it("never discounts more than the subtotal", async () => {
    findUnique.mockResolvedValue(coupon({ percentOff: null, amountOff: 50_000 }));

    // Otherwise a fixed-amount coupon on a small basket produces a negative
    // total and the shop pays the customer.
    expect(await checkCoupon("SAVE10", 3_000)).toMatchObject({ ok: true, discount: 3_000 });
  });

  it("always yields a whole number of tetri", async () => {
    findUnique.mockResolvedValue(coupon({ percentOff: 33 }));

    // 33% of ₾10.10 is ₾3.333. The discount must land on a whole tetri, or the
    // order total carries a fraction into whatever eventually charges a card.
    const result = await checkCoupon("SAVE10", 1_010);

    expect(result).toMatchObject({ ok: true, discount: 333 });
    expect(Number.isInteger((result as { discount: number }).discount)).toBe(true);
  });

  it("treats a coupon with neither percent nor amount as zero, not NaN", async () => {
    findUnique.mockResolvedValue(coupon({ percentOff: null, amountOff: null }));

    expect(await checkCoupon("SAVE10", 10_000)).toMatchObject({ ok: true, discount: 0 });
  });
});
