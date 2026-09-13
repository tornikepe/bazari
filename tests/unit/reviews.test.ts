import { describe, expect, it } from "vitest";
import { averageRating, isRating, mayReview } from "@/lib/review-rules";

describe("mayReview", () => {
  it("needs a delivered order of the product", () => {
    expect(mayReview(true, [{ id: "o1", status: "delivered" }])).toEqual({ ok: true, orderId: "o1" });
  });

  it("says why not, precisely", () => {
    expect(mayReview(false, [])).toEqual({ ok: false, reason: "sign-in" });
    expect(mayReview(true, [])).toEqual({ ok: false, reason: "not-bought" });
    expect(mayReview(true, [{ id: "o1", status: "shipped" }])).toEqual({ ok: false, reason: "not-delivered" });
  });

  it("does not count a cancelled order as bought", () => {
    expect(mayReview(true, [{ id: "o1", status: "cancelled" }])).toEqual({ ok: false, reason: "not-bought" });
  });

  it("picks the delivered one among several", () => {
    expect(
      mayReview(true, [
        { id: "o1", status: "cancelled" },
        { id: "o2", status: "delivered" },
        { id: "o3", status: "pending" },
      ]),
    ).toEqual({ ok: true, orderId: "o2" });
  });
});

describe("ratings", () => {
  it("accepts whole stars from one to five", () => {
    expect(isRating(1)).toBe(true);
    expect(isRating(5)).toBe(true);
    expect(isRating(0)).toBe(false);
    expect(isRating(6)).toBe(false);
    expect(isRating(4.5)).toBe(false);
    expect(isRating("5")).toBe(false);
  });

  it("averages to one decimal, and is nothing with nobody", () => {
    expect(averageRating(0, 0)).toBe(0);
    expect(averageRating(14, 3)).toBe(4.7);
    expect(averageRating(5, 1)).toBe(5);
  });
});
