import { describe, expect, it } from "vitest";
import { crossedLowStock } from "@/lib/stock";

/**
 * When the shop is told a product is running out.
 *
 * The rule is one comparison, and it is the whole feature: an alert that fired
 * on every sale below the threshold would be a message a day about the same
 * six products, and one that fired only on reaching exactly the threshold
 * would miss the sale that took two units and stepped over it.
 */
describe("crossedLowStock", () => {
  it("fires on the sale that reaches the threshold", () => {
    expect(crossedLowStock(11, 10, 10)).toBe(true);
  });

  it("fires on the sale that steps over it", () => {
    // Two taken from eleven lands on nine, which is past ten and never on it.
    expect(crossedLowStock(11, 9, 10)).toBe(true);
  });

  it("says nothing while the product is still above it", () => {
    expect(crossedLowStock(30, 12, 10)).toBe(false);
  });

  it("says nothing once the shop has already been told", () => {
    // The second, third and thirtieth sale below the line are all silent.
    expect(crossedLowStock(10, 9, 10)).toBe(false);
    expect(crossedLowStock(3, 2, 10)).toBe(false);
    expect(crossedLowStock(1, 0, 10)).toBe(false);
  });

  it("treats a threshold of zero as 'tell me when it runs out'", () => {
    expect(crossedLowStock(1, 0, 0)).toBe(true);
    expect(crossedLowStock(5, 3, 0)).toBe(false);
  });
});
