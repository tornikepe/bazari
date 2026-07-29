import { describe, expect, it } from "vitest";
import { toMinor, fromMinor } from "@/lib/payments";
import { isPaymentProvider, PAYMENT_PROVIDERS } from "@/lib/payments/guards";
import { isPaymentMethod, isPaymentStatus } from "@/lib/payment";

/**
 * `toMinor` is the boundary between the app's Float prices and the integer
 * tetri a gateway is actually asked to charge. Anything wrong here is money
 * wrong, so the awkward cases are pinned.
 */
describe("toMinor", () => {
  it("converts whole lari", () => {
    expect(toMinor(149)).toBe(14900);
  });

  it("converts a two-decimal price", () => {
    expect(toMinor(149.99)).toBe(14999);
  });

  it("handles values that are not exact in binary floating point", () => {
    // 0.1 + 0.2 is 0.30000000000000004; without the round() this would be
    // 30.000000000000004 tetri and the gateway would reject it outright.
    expect(toMinor(0.1 + 0.2)).toBe(30);
  });

  it("rounds two look-alike halfway prices in opposite directions", () => {
    // Both read as "half a tetri", but 1.005 * 100 is 100.49999999999999
    // while 8.115 * 100 is exactly 811.5. This is why the *source* of an
    // amount should be an integer, not a Float that is rounded on the way
    // out — see Payment.amount.
    expect(toMinor(1.005)).toBe(100);
    expect(toMinor(8.115)).toBe(812);
  });

  it("is exact for a large basket", () => {
    expect(toMinor(12345.67)).toBe(1234567);
  });

  it("round-trips through fromMinor", () => {
    for (const amount of [0, 1, 149.99, 1234.56, 99999.99]) {
      expect(fromMinor(toMinor(amount))).toBeCloseTo(amount, 2);
    }
  });

  it("never returns a fraction", () => {
    for (const amount of [1.111, 2.999, 0.005, 33.335]) {
      expect(Number.isInteger(toMinor(amount))).toBe(true);
    }
  });
});

describe("enum guards", () => {
  it("accepts every declared provider", () => {
    for (const id of PAYMENT_PROVIDERS) expect(isPaymentProvider(id)).toBe(true);
  });

  it("rejects anything else", () => {
    // These arrive from a URL segment, so they can be any string at all.
    for (const value of ["", "MANUAL", "stripe", "../admin", null, 7, {}]) {
      expect(isPaymentProvider(value)).toBe(false);
    }
  });

  it("guards payment methods and statuses the same way", () => {
    expect(isPaymentMethod("cash_on_delivery")).toBe(true);
    expect(isPaymentMethod("crypto")).toBe(false);
    expect(isPaymentStatus("paid")).toBe(true);
    expect(isPaymentStatus("PAID")).toBe(false);
  });
});
