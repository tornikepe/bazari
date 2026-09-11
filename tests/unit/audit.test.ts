import { describe, expect, it } from "vitest";
import { diff } from "@/lib/audit-diff";

describe("diff", () => {
  it("reports only the fields that moved", () => {
    expect(diff({ price: 100, stock: 5, name: "x" }, { price: 120, stock: 5 }, ["price", "stock", "name"])).toEqual({
      price: [100, 120],
    });
  });

  it("treats a field missing from the update as unchanged, not cleared", () => {
    expect(diff({ price: 100, oldPrice: 150 }, { price: 90 }, ["price", "oldPrice"])).toEqual({
      price: [100, 90],
    });
  });

  it("compares by value, so a date or a JSON column is not always 'changed'", () => {
    const when = new Date("2026-09-11T00:00:00Z");
    expect(diff({ expiresAt: when, specs: [{ a: 1 }] }, { expiresAt: new Date(when), specs: [{ a: 1 }] }, ["expiresAt", "specs"])).toEqual({});
  });

  it("records a clearing as a change to null", () => {
    expect(diff({ oldPrice: 150 as number | null }, { oldPrice: null }, ["oldPrice"])).toEqual({
      oldPrice: [150, null],
    });
  });
});
