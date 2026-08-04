import { describe, expect, it } from "vitest";
import { niceCeiling } from "@/components/admin/SalesChart";

/**
 * The chart's vertical scale.
 *
 * Two things have to hold at once, and they pull against each other: the top
 * of the scale must be a number a person can divide into quarters in their
 * head, and it must not be so far above the tallest bar that the chart becomes
 * mostly empty space. Rounding up to the next power of ten satisfies the first
 * and fails the second badly — a ₾5,643 peak would be drawn against ₾10,000
 * and the busiest day of the month would reach barely half the plot.
 */
describe("niceCeiling", () => {
  it("returns a round number at or above the peak", () => {
    for (const peak of [1, 37, 250, 999, 5643, 12_345, 987_654]) {
      const ceiling = niceCeiling(peak);
      expect(ceiling, `${peak} → ${ceiling}`).toBeGreaterThanOrEqual(peak);
    }
  });

  it("divides into readable quarters", () => {
    // The four gridlines are quarters of the ceiling. Each has to land on a
    // whole unit, or the axis reads ₾1,410.75 and the line stops helping.
    for (const peak of [37, 250, 5643, 12_345, 87_400]) {
      const ceiling = niceCeiling(peak);
      for (const fraction of [0.25, 0.5, 0.75]) {
        expect(Number.isInteger(ceiling * fraction), `${ceiling} × ${fraction}`).toBe(true);
      }
    }
  });

  it("does not waste more than a third of the plot", () => {
    // The tallest bar should fill at least two thirds of the height. This is
    // the constraint that rules out rounding to powers of ten.
    for (const peak of [1_100, 3_400, 5_643, 6_100, 9_900, 41_000]) {
      const ceiling = niceCeiling(peak);
      expect(peak / ceiling, `peak ${peak} against ceiling ${ceiling}`).toBeGreaterThan(0.66);
    }
  });

  it("gives the case that prompted this a clean scale", () => {
    // ₾5,643 in tetri. The old rounding returned the peak unchanged, so the
    // top gridline was labelled ₾5,643.00.
    expect(niceCeiling(564_300)).toBe(600_000);
  });

  it("never returns zero, whatever it is given", () => {
    // A zero ceiling divides by zero when scaling the bars. The chart returns
    // early on an empty series, but that is a second place this could break.
    expect(niceCeiling(0)).toBeGreaterThan(0);
    expect(niceCeiling(-5)).toBeGreaterThan(0);
  });
});
