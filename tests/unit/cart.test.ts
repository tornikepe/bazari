import { describe, expect, it } from "vitest";
import { cartTotals } from "@/lib/cart-store";
import { DEFAULT_SHIPPING } from "@/lib/cart-rules";

type Item = Parameters<typeof cartTotals>[0][number];

/** `price` is tetri, like every amount in the app. */
function item(price: number, quantity = 1): Item {
  return {
    productId: `p${price}`,
    slug: "x",
    nameKa: "x",
    nameEn: "x",
    price,
    image: "/x.svg",
    quantity,
  } as Item;
}

describe("cartTotals", () => {
  it("is all zeroes for an empty cart", () => {
    expect(cartTotals([])).toEqual({ count: 0, subtotal: 0, shipping: 0, total: 0 });
  });

  it("does not charge shipping on an empty cart", () => {
    // Shipping on nothing would show a total above zero with no items.
    expect(cartTotals([]).shipping).toBe(0);
  });

  it("multiplies price by quantity", () => {
    expect(cartTotals([item(1_000, 3)]).subtotal).toBe(3_000);
  });

  it("counts units, not lines", () => {
    expect(cartTotals([item(1_000, 3), item(2_000, 2)]).count).toBe(5);
  });

  it("charges shipping below the free threshold", () => {
    const totals = cartTotals([item(DEFAULT_SHIPPING.freeShippingThreshold - 1)]);

    expect(totals.shipping).toBe(DEFAULT_SHIPPING.shippingFee);
    expect(totals.total).toBe(DEFAULT_SHIPPING.freeShippingThreshold - 1 + DEFAULT_SHIPPING.shippingFee);
  });

  it("gives free shipping exactly at the threshold", () => {
    // The boundary is the interesting case: "over ₾200" vs "₾200 or more"
    // are different promises, and the UI says orders *over* 200 ship free.
    const totals = cartTotals([item(DEFAULT_SHIPPING.freeShippingThreshold)]);

    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(DEFAULT_SHIPPING.freeShippingThreshold);
  });

  it("gives free shipping above the threshold", () => {
    expect(cartTotals([item(DEFAULT_SHIPPING.freeShippingThreshold + 1)]).shipping).toBe(0);
  });

  it("reaches the threshold across several lines", () => {
    // ₾150 + ₾60 clears the ₾200 free-shipping threshold.
    const totals = cartTotals([item(15_000), item(6_000)]);

    expect(totals.subtotal).toBe(21_000);
    expect(totals.shipping).toBe(0);
  });

  it("keeps every total a whole number of tetri", () => {
    // The reason for the integer refactor: no sum of prices can produce a
    // fraction, so nothing downstream has to round.
    const totals = cartTotals([item(3_333, 3), item(1_667, 7)]);

    expect(Number.isInteger(totals.subtotal)).toBe(true);
    expect(Number.isInteger(totals.total)).toBe(true);
    expect(totals.subtotal).toBe(3_333 * 3 + 1_667 * 7);
  });
});
