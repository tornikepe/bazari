import { describe, expect, it } from "vitest";
import { DEFAULT_SHIPPING, shippingFor } from "@/lib/cart-rules";

const rules = { freeShippingThreshold: 20_000, shippingFee: 1_500 };

describe("shippingFor with a delivery choice", () => {
  it("is the shop-wide rule when no choice is made", () => {
    expect(shippingFor(5_000, 1, rules)).toBe(1_500);
    expect(shippingFor(20_000, 1, rules)).toBe(0);
  });

  it("costs nothing to collect", () => {
    expect(shippingFor(5_000, 1, rules, { method: "pickup" })).toBe(0);
  });

  it("is still nothing for an empty basket, whatever was chosen", () => {
    expect(shippingFor(0, 0, rules, { method: "courier", zone: { fee: 2_500, freeAbove: null } })).toBe(0);
  });

  it("charges the zone's fee below the shop-wide threshold when the zone defers", () => {
    const zone = { fee: 2_500, freeAbove: null };
    expect(shippingFor(19_999, 1, rules, { method: "courier", zone })).toBe(2_500);
    expect(shippingFor(20_000, 1, rules, { method: "courier", zone })).toBe(0);
  });

  it("lets a zone set its own threshold", () => {
    const zone = { fee: 2_500, freeAbove: 30_000 };
    // The shop-wide threshold is passed, and the zone says not yet.
    expect(shippingFor(25_000, 1, rules, { method: "courier", zone })).toBe(2_500);
    expect(shippingFor(30_000, 1, rules, { method: "courier", zone })).toBe(0);
  });

  it("a courier with no zone is exactly the old rule", () => {
    expect(shippingFor(5_000, 1, DEFAULT_SHIPPING, { method: "courier", zone: null })).toBe(
      shippingFor(5_000, 1, DEFAULT_SHIPPING),
    );
  });
});
