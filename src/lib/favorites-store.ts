/**
 * Wishlist of product ids, persisted to localStorage.
 *
 * Same external-store shape as the cart (see `cart-store.ts`) so it reads
 * through `useSyncExternalStore` with no mount effect and no hydration
 * mismatch, and syncs across tabs.
 */
const STORAGE_KEY = "bazari.favorites.v1";

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

/**
 * Replaces the list wholesale — what the account sync does on arrival, once
 * the browser's ids and the account's have been reconciled on the server.
 *
 * Silent when nothing changes, so a sync that finds the two already agreeing
 * does not wake every subscriber for no reason.
 */
export function replaceFavorites(next: string[]) {
  const same = next.length === ids.length && next.every((id, index) => id === ids[index]);
  if (same) return;
  commit([...next]);
}

/* ------------------------------------------------------------------ */
/* What the account has confirmed                                      */
/* ------------------------------------------------------------------ */

/**
 * The list as the account last acknowledged it, kept beside the list itself.
 *
 * A heart pressed and the tab closed in the same breath is a write that may
 * never have arrived. Without a record of what *did* arrive, the next visit
 * could only merge — and a merge would press the heart back. With it, the
 * next visit sees "the browser has this and the account was last known not
 * to" and sends exactly that difference. Signed-out browsers never write it.
 */
const SYNCED_KEY = "bazari.favorites.synced.v1";

export function readSynced(): string[] {
  try {
    const raw = window.localStorage.getItem(SYNCED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeSynced(next: string[]) {
  try {
    window.localStorage.setItem(SYNCED_KEY, JSON.stringify(next));
  } catch {
    // Nothing to do: the next sync simply sends more than it needed to.
  }
}
