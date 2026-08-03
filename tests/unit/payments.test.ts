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
  // Since the integer refactor an order total is already whole tetri, so this
  // is the identity. It stays as a named boundary: a gateway that wants a
  // different unit gets one obvious place to convert.
  it("passes a whole tetri amount straight through", () => {
    expect(toMinor(14_900)).toBe(14_900);
    expect(toMinor(0)).toBe(0);
    expect(toMinor(1)).toBe(1);
  });

  it("never lets a fraction reach a gateway", () => {
    // Nothing upstream should produce one, but an amount charged to a card is
    // the last place to find out that something did.
    for (const amount of [1.4, 2.5, 99.99, 1234.567]) {
      expect(Number.isInteger(toMinor(amount))).toBe(true);
    }
  });

  it("round-trips through fromMinor for display", () => {
    expect(fromMinor(toMinor(14_999))).toBe(149.99);
    expect(fromMinor(0)).toBe(0);
  });

  it("is exact for a large basket, where a float would drift", () => {
    // 1,234,567 tetri is ₾12,345.67 — a figure a float cannot hold exactly.
    expect(toMinor(1_234_567)).toBe(1_234_567);
    expect(fromMinor(1_234_567)).toBeCloseTo(12_345.67, 2);
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
