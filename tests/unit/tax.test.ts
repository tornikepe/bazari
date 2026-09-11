import { describe, expect, it } from "vitest";
import { isVatRate, vatIncluded } from "@/lib/tax";

describe("vatIncluded", () => {
  it("is the share of a tax-inclusive total, not an amount on top", () => {
    // ₾118.00 at 18% is ₾100.00 of goods and ₾18.00 of VAT.
    expect(vatIncluded(11_800, 18)).toBe(1_800);
  });

  it("rounds to the tetri once, the way a fiscal printer does", () => {
    // 22900 * 18 / 118 = 3493.22…
    expect(vatIncluded(22_900, 18)).toBe(3_493);
    // 1 * 18 / 118 = 0.15… — a one-tetri order carries no whole tetri of tax.
    expect(vatIncluded(1, 18)).toBe(0);
  });

  it("is nothing for a shop that is not registered", () => {
    expect(vatIncluded(11_800, 0)).toBe(0);
  });

  it("never invents tax for nothing", () => {
    expect(vatIncluded(0, 18)).toBe(0);
    expect(vatIncluded(-500, 18)).toBe(0);
    expect(vatIncluded(Number.NaN, 18)).toBe(0);
  });
});

describe("isVatRate", () => {
  it("accepts a whole percent in a sane range", () => {
    expect(isVatRate(18)).toBe(true);
    expect(isVatRate(0)).toBe(true);
  });

  it("refuses fractions, negatives and nonsense", () => {
    expect(isVatRate(18.5)).toBe(false);
    expect(isVatRate(-1)).toBe(false);
    expect(isVatRate(99)).toBe(false);
    expect(isVatRate("18")).toBe(false);
  });
});
