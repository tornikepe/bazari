import { describe, expect, it } from "vitest";
import { cartTotals } from "@/lib/cart-store";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/cart-rules";

type Item = Parameters<typeof cartTotals>[0][number];

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
    expect(cartTotals([item(10, 3)]).subtotal).toBe(30);
  });

  it("counts units, not lines", () => {
    expect(cartTotals([item(10, 3), item(20, 2)]).count).toBe(5);
  });

  it("charges shipping below the free threshold", () => {
    const totals = cartTotals([item(FREE_SHIPPING_THRESHOLD - 1)]);

    expect(totals.shipping).toBe(SHIPPING_FEE);
    expect(totals.total).toBe(FREE_SHIPPING_THRESHOLD - 1 + SHIPPING_FEE);
  });

  it("gives free shipping exactly at the threshold", () => {
    // The boundary is the interesting case: "over ₾200" vs "₾200 or more"
    // are different promises, and the UI says orders *over* 200 ship free.
    const totals = cartTotals([item(FREE_SHIPPING_THRESHOLD)]);

    expect(totals.shipping).toBe(0);
    expect(totals.total).toBe(FREE_SHIPPING_THRESHOLD);
  });

  it("gives free shipping above the threshold", () => {
    expect(cartTotals([item(FREE_SHIPPING_THRESHOLD + 1)]).shipping).toBe(0);
  });

  it("reaches the threshold across several lines", () => {
    const totals = cartTotals([item(150), item(60)]);

    expect(totals.subtotal).toBe(210);
    expect(totals.shipping).toBe(0);
  });
});
