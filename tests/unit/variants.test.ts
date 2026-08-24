import { describe, expect, it } from "vitest";
import {
  combinations,
  isComplete,
  labelFor,
  priceOf,
  stockOf,
  totalStock,
  variantFor,
  type Option,
  type Variant,
} from "@/lib/variants";

/**
 * The arithmetic behind size and colour.
 *
 * Worth testing on its own because the same answers are needed twice: the
 * product page works out which combination a pair of dropdowns adds up to, and
 * `placeOrder` works out the same thing again before charging anybody. Two
 * implementations of "which variant is this?" agree right up until they do
 * not, which is why there is one and why it is here.
 */

const options: Option[] = [
  {
    id: "size",
    name: "Size",
    values: [
      { id: "s", label: "S" },
      { id: "m", label: "M" },
    ],
  },
  {
    id: "colour",
    name: "Colour",
    values: [
      { id: "red", label: "Red" },
      { id: "blue", label: "Blue" },
    ],
  },
];

const variant = (id: string, valueIds: string[], extra: Partial<Variant> = {}): Variant => ({
  id,
  sku: `SKU-${id}`,
  price: null,
  stock: 5,
  isActive: true,
  valueIds,
  ...extra,
});

const variants = [
  variant("s-red", ["s", "red"]),
  variant("s-blue", ["s", "blue"], { price: 9900 }),
  variant("m-red", ["m", "red"], { stock: 0 }),
  variant("m-blue", ["m", "blue"], { isActive: false, stock: 4 }),
];

describe("variantFor", () => {
  it("finds the combination both answers point at", () => {
    expect(variantFor(variants, { size: "s", colour: "blue" })?.id).toBe("s-blue");
  });

  it("does not guess from a half-made choice", () => {
    // One of two answers matches two combinations, and picking either would be
    // showing a price for something nobody asked for.
    expect(variantFor(variants, { size: "s" })).toBeNull();
  });

  it("is nothing at all before anything is chosen", () => {
    expect(variantFor(variants, {})).toBeNull();
  });

  it("returns nothing for a pair that was never made", () => {
    expect(variantFor(variants, { size: "l", colour: "red" })).toBeNull();
  });
});

describe("isComplete", () => {
  it("wants an answer to every question", () => {
    expect(isComplete(options, { size: "s" })).toBe(false);
    expect(isComplete(options, { size: "s", colour: "red" })).toBe(true);
  });
});

describe("priceOf", () => {
  it("uses the product's price when the variant has none", () => {
    expect(priceOf(14900, variants[0]!)).toBe(14900);
  });

  it("lets a variant override it", () => {
    expect(priceOf(14900, variants[1]!)).toBe(9900);
  });

  it("prices a product with no variants at all", () => {
    expect(priceOf(14900, null)).toBe(14900);
  });

  it("treats a variant priced at zero as priced, not as unpriced", () => {
    // The difference `null` carries: free is a price, "not set" is not.
    expect(priceOf(14900, variant("free", ["s", "red"], { price: 0 }))).toBe(0);
  });
});

describe("stockOf", () => {
  it("is the product's own when there are no variants", () => {
    expect(stockOf(12, [], null)).toBe(12);
  });

  it("is the chosen variant's", () => {
    expect(stockOf(12, variants, variants[2]!)).toBe(0);
  });

  it("is nothing while nothing is chosen", () => {
    // Not the product's figure: a variant product's total says nothing about
    // whether the combination in front of the shopper can be bought.
    expect(stockOf(12, variants, null)).toBe(0);
  });
});

describe("totalStock", () => {
  it("adds up what can actually be bought", () => {
    // 5 + 5 + 0, and not the switched-off combination's 4.
    expect(totalStock(variants)).toBe(10);
  });
});

describe("labelFor", () => {
  it("names a combination in the order the options are asked", () => {
    expect(labelFor(options, variants[1]!)).toBe("S · Blue");
  });
});

describe("combinations", () => {
  it("produces every pair, first option varying slowest", () => {
    expect(combinations(options)).toEqual([
      ["s", "red"],
      ["s", "blue"],
      ["m", "red"],
      ["m", "blue"],
    ]);
  });

  it("is one empty combination for a product with no options", () => {
    // Which is what makes "a product without variants" fall out of the same
    // code rather than needing a branch of its own.
    expect(combinations([])).toEqual([[]]);
  });
});
