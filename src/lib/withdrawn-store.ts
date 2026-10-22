/**
 * What the shop stopped selling while it was sitting in somebody's browser.
 *
 * `StaleItemSweep` takes those lines out of the cart and the wishlist, which
 * is right — an order cannot be placed for them — but taking them out without
 * a word is not: a cart that held a jacket a minute ago and is empty now
 * looks like the shop lost it. This is the one sentence that explains it,
 * held here rather than passed down because the sweep runs in the header and
 * the sentence belongs on the cart and wishlist pages.
 *
 * Deliberately not persisted. It is news about this page load; a reload of a
 * cart that is already correct should say nothing.
 *
 * Same external-store shape as the cart and the wishlist beside it.
 */

export type Withdrawn = { cart: number; favorites: number };

/** Stable reference — `getSnapshot` must never return a fresh object. */
const NONE: Withdrawn = { cart: 0, favorites: 0 };

let state: Withdrawn = NONE;

const listeners = new Set<() => void>();

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Withdrawn {
  return state;
}

/** The server knows nothing about it, and this must not differ on hydration. */
export function getServerSnapshot(): Withdrawn {
  return NONE;
}

/** Counted up across batches: a hundred-line cart is swept in several calls. */
export function noteWithdrawn(next: { cart?: number; favorites?: number }) {
  const cart = state.cart + (next.cart ?? 0);
  const favorites = state.favorites + (next.favorites ?? 0);
  if (cart === state.cart && favorites === state.favorites) return;

  state = { cart, favorites };
  for (const listener of listeners) listener();
}
