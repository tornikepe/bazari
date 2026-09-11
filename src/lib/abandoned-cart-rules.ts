/**
 * When a cart counts as left behind. Pure, so the rule can be tested without
 * a database; `abandoned-carts.ts` applies it.
 */

export type CartLine = { productId: string; variantId?: string; quantity: number };

const HOUR_MS = 60 * 60 * 1000;

/** Untouched for at least this long before anybody is written to. */
export const REMIND_AFTER_HOURS = 24;
/** And not older than this — a week-old cart is not a reminder, it is a nag. */
export const FORGET_AFTER_DAYS = 7;

export function isDueForReminder(
  snapshot: { updatedAt: Date; remindedAt: Date | null },
  lastOrderAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (snapshot.remindedAt) return false;

  const age = now.getTime() - snapshot.updatedAt.getTime();
  if (age < REMIND_AFTER_HOURS * HOUR_MS) return false;
  if (age > FORGET_AFTER_DAYS * 24 * HOUR_MS) return false;

  // An order placed since the cart was last touched means they bought — the
  // cart in the browser was cleared by the checkout, and the snapshot with
  // it; this is the belt to that pair of braces.
  if (lastOrderAt && lastOrderAt.getTime() >= snapshot.updatedAt.getTime()) return false;

  return true;
}
