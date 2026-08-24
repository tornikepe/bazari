/**
 * The rule for when the shop is told a product is running out.
 *
 * Its own module, with nothing imported into it, for the same reason
 * `order-status.ts` is one: the mail that acts on it needs the database and
 * the test that checks it must not. A rule that can only be exercised by
 * standing up Postgres is a rule that stops being exercised.
 */

/**
 * Whether this sale is the one worth a message.
 *
 * The crossing, and only the crossing. A product already at or below its
 * threshold before the sale generates nothing: the shop has been told, and a
 * message on every subsequent sale is a message a day about the same six
 * products — the fastest way to make people filter these into a folder they
 * never open.
 *
 * A threshold of zero means "tell me when it runs out", which is a real answer
 * and falls out of the same comparison: `after <= 0` is true only when there
 * is nothing left.
 */
export function crossedLowStock(before: number, after: number, threshold: number): boolean {
  return after <= threshold && before > threshold;
}
