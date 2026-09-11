/**
 * VAT, worked out the one way it can be for a shop that prints tax-inclusive
 * prices.
 *
 * Georgian retail prices carry the tax inside them: a shelf label of ₾118 is
 * ₾100 of goods and ₾18 of VAT, and the shopper pays ₾118. So the figure a
 * receipt shows is the share of the total that is tax, never a line that makes
 * the total bigger — `total` is what is charged before and after this runs.
 *
 * Integer arithmetic on tetri, rounded once. `total * rate / (100 + rate)` is
 * exact until the division, and `Math.round` there is the same rounding a
 * fiscal printer applies.
 */
export function vatIncluded(total: number, rate: number): number {
  if (!Number.isFinite(total) || !Number.isFinite(rate) || total <= 0 || rate <= 0) return 0;
  return Math.round((total * rate) / (100 + rate));
}

/** The settings form takes a whole percent; anything else is refused. */
export function isVatRate(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 50;
}
