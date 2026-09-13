/**
 * What makes a review real, with no database in it.
 *
 * A star is worth exactly as much as the certainty that the person behind it
 * bought the thing. So the one rule: the customer has an order of this
 * product that reached `delivered`. Not placed — placed and cancelled is not
 * bought — and not shipped, because nobody can review what has not arrived.
 */

export const RATING_MIN = 1;
export const RATING_MAX = 5;
export const TITLE_MAX = 80;
export const BODY_MAX = 2000;

export function isRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
}

/** The average, to one decimal, from the two columns the product carries. */
export function averageRating(sum: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round((sum / count) * 10) / 10;
}

/** What a shopper is told when they cannot write one. */
export type ReviewBar = "sign-in" | "not-bought" | "not-delivered";

/**
 * Whether this customer may write about this product, from what their orders
 * say. `orders` are theirs that contain the product, any status.
 */
export function mayReview(
  signedIn: boolean,
  orders: readonly { status: string; id: string }[],
): { ok: true; orderId: string } | { ok: false; reason: ReviewBar } {
  if (!signedIn) return { ok: false, reason: "sign-in" };
  const delivered = orders.find((order) => order.status === "delivered");
  if (delivered) return { ok: true, orderId: delivered.id };
  if (orders.some((order) => order.status !== "cancelled")) {
    return { ok: false, reason: "not-delivered" };
  }
  return { ok: false, reason: "not-bought" };
}
