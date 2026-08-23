/**
 * The products this browser has looked at, most recent first.
 *
 * Same external-store shape as the cart and the wishlist (see
 * `cart-store.ts`) so it reads through `useSyncExternalStore` with no mount
 * effect and no hydration mismatch, and stays in step across tabs.
 *
 * Ids only. Names and prices change, and a list of stale copies rendered from
 * `localStorage` would show a price the shop no longer charges — the ids are
 * resolved against the database when the row is drawn.
 */
const STORAGE_KEY = "bazari.viewed.v1";

/**
 * How many are kept.
 *
 * Enough that a row of four survives one of them selling out or being
 * withdrawn, and short enough that a browser used for a year does not carry a
 * thousand ids into every page it renders.
 */
export const MAX_VIEWED = 12;

/** Stable reference — `getSnapshot` must never return a fresh array. */
const EMPTY: string[] = [];

function readStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    const ids = parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_VIEWED);
    return ids.length > 0 ? ids : EMPTY;
  } catch {
    return EMPTY;
  }
}

let ids: string[] = typeof window === "undefined" ? EMPTY : readStorage();

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: string[]) {
  ids = next.length > 0 ? next : EMPTY;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or a full quota — the in-memory list still works.
  }

  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    ids = readStorage();
    emit();
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot() {
  return ids;
}

export function getServerSnapshot() {
  return EMPTY;
}

/**
 * Records a visit, newest first and without repeats.
 *
 * Re-visiting a product moves it to the front rather than adding it again:
 * "recently viewed" is a set in an order, not a history, and a reader who
 * opened one thing four times should not see four of it.
 */
export function recordView(productId: string) {
  if (!productId) return;

  const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_VIEWED);

  // Nothing changed, so nothing is written or announced — re-rendering every
  // subscriber on a page reload of the same product is work for no one.
  if (next.length === ids.length && next.every((id, index) => id === ids[index])) return;

  commit(next);
}

export function clearViewed() {
  commit(EMPTY);
}
