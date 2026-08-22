import { describe, expect, it } from "vitest";
import { countText, getDictionary } from "@/lib/i18n";

/**
 * Singular and plural.
 *
 * The shop said "1 products found", "1 products" on the wishlist, "1 business
 * days" on every product that ships in a day, and "1 products" on four
 * separate order lists. English needs the distinction; Georgian does not
 * inflect a noun after a numeral, which is why the choice lives in the
 * dictionary rather than in a rule that would have to know that.
 */
describe("countText", () => {
  const en = getDictionary("en");
  const ka = getDictionary("ka");

  it("uses the singular for exactly one", () => {
    expect(countText(en.catalog.resultsCountOne, en.catalog.resultsCount, 1)).toBe(
      "1 product found",
    );
  });

  it("uses the plural for none and for many", () => {
    expect(countText(en.catalog.resultsCountOne, en.catalog.resultsCount, 0)).toBe(
      "0 products found",
    );
    expect(countText(en.catalog.resultsCountOne, en.catalog.resultsCount, 6)).toBe(
      "6 products found",
    );
  });

  it("says the same thing either way in Georgian", () => {
    // Not an accident to be tidied up later: Georgian does not inflect here,
    // so the two forms being identical is the correct translation.
    expect(countText(ka.catalog.resultsCountOne, ka.catalog.resultsCount, 1)).toBe(
      countText(ka.catalog.resultsCountOne, ka.catalog.resultsCount, 5).replace("5", "1"),
    );
  });

  it("covers the other three places that had the fault", () => {
    expect(countText(en.favorites.countOne, en.favorites.count, 1)).toBe("1 product");
    expect(countText(en.product.shippingDaysOne, en.product.shippingDays, 1)).toBe(
      "1 business day",
    );
    expect(countText(en.admin.productCountOne, en.admin.productCount, 1)).toBe("1 product");
  });

  it("still fills the number in", () => {
    expect(countText(en.product.shippingDaysOne, en.product.shippingDays, 14)).toBe(
      "14 business days",
    );
  });
});
