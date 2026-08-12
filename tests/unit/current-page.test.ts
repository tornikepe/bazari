import { describe, expect, it } from "vitest";
import { isCurrentPage } from "@/lib/current-page";

describe("isCurrentPage", () => {
  it("marks the plain page it is on", () => {
    expect(isCurrentPage("/about", "/about", "")).toBe(true);
    expect(isCurrentPage("/contact", "/about", "")).toBe(false);
  });

  it("does not mark a different path that starts the same way", () => {
    expect(isCurrentPage("/cart", "/cart-something", "")).toBe(false);
    expect(isCurrentPage("/catalog", "/catalogue", "")).toBe(false);
  });

  // The pair this function exists for. The menu has both "Catalogue"
  // (`/catalog`) and "Deals" (`/catalog?sale=1`), which share a path.
  describe("a query is part of the address", () => {
    it("marks the filtered link only when the filter is on", () => {
      expect(isCurrentPage("/catalog?sale=1", "/catalog", "?sale=1")).toBe(true);
      expect(isCurrentPage("/catalog?sale=1", "/catalog", "")).toBe(false);
    });

    it("does not mark the plain link while a filter is applied", () => {
      // Otherwise standing on Deals marks Catalogue as current too, and two
      // current pages is worse than none.
      expect(isCurrentPage("/catalog", "/catalog", "?sale=1")).toBe(false);
      expect(isCurrentPage("/catalog", "/catalog", "?category=audio")).toBe(false);
    });

    it("marks the plain link when nothing is applied", () => {
      expect(isCurrentPage("/catalog", "/catalog", "")).toBe(true);
    });

    it("requires the value to match, not merely the key", () => {
      expect(isCurrentPage("/catalog?category=audio", "/catalog", "?category=tools")).toBe(false);
      expect(isCurrentPage("/catalog?category=audio", "/catalog", "?category=audio")).toBe(true);
    });

    it("is not fooled by extra parameters on the page", () => {
      // `/catalog?category=audio` is not the current page when the reader has
      // also sorted or paged — they have moved on from it.
      expect(isCurrentPage("/catalog?category=audio", "/catalog", "?category=audio&sort=name")).toBe(
        false,
      );
    });

    it("does not care about the order they are written in", () => {
      expect(
        isCurrentPage("/catalog?category=audio&sale=1", "/catalog", "?sale=1&category=audio"),
      ).toBe(true);
    });
  });

  describe("things that are not a page", () => {
    it("never marks an anchor", () => {
      // An anchor is a place *within* the page; marking it takes the mark from
      // the real entry for that page.
      expect(isCurrentPage("#main", "/", "")).toBe(false);
      expect(isCurrentPage("#orders", "/account", "")).toBe(false);
    });

    it("never marks another site", () => {
      expect(isCurrentPage("https://example.test/about", "/about", "")).toBe(false);
      expect(isCurrentPage("//example.test/about", "/about", "")).toBe(false);
      expect(isCurrentPage("mailto:someone@example.test", "/contact", "")).toBe(false);
    });
  });

  it("tolerates the leading question mark being there or not", () => {
    expect(isCurrentPage("/catalog?sale=1", "/catalog", "sale=1")).toBe(true);
  });
});
