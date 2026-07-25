/**
 * Wishlist of product ids, persisted to localStorage.
 *
 * Same external-store shape as the cart (see `cart-store.ts`) so it reads
 * through `useSyncExternalStore` with no mount effect and no hydration
 * mismatch, and syncs across tabs.
 */
const STORAGE_KEY = "chinamart.favorites.v1";

/** Stable reference — `getSnapshot` must never return a fresh array. */
const EMPTY: string[] = [];

function readStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    const ids = parsed.filter((id): id is string => typeof id === "string");
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

export function toggleFavorite(productId: string) {
  commit(
    ids.includes(productId)
      ? ids.filter((id) => id !== productId)
      : [...ids, productId],
  );
}

export function clearFavorites() {
  commit(EMPTY);
}
