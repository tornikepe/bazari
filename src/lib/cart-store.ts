/**
 * The cart lives in localStorage, which makes it an *external store* rather
 * than React state. Modelling it as one (and reading it through
 * `useSyncExternalStore`) means no mount effect is needed to hydrate it, and
 * React handles the server/client snapshot difference itself.
 *
 * It also gets cross-tab sync for free via the `storage` event.
 */
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/cart-rules";

export type CartItem = {
  productId: string;
  slug: string;
  nameKa: string;
  nameEn: string;
  image: string;
  price: number;
  stock: number;
  quantity: number;
};

const STORAGE_KEY = "chinamart.cart.v1";

/** Stable reference — `getSnapshot` must never return a fresh array. */
const EMPTY: CartItem[] = [];

function readStorage(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    const items = parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).productId === "string" &&
        typeof (item as CartItem).price === "number" &&
        typeof (item as CartItem).quantity === "number",
    );

    return items.length > 0 ? items : EMPTY;
  } catch {
    return EMPTY;
  }
}

// Initialised once per bundle: `EMPTY` on the server, real contents on the
// client, where module init runs before the first render.
let items: CartItem[] = typeof window === "undefined" ? EMPTY : readStorage();

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: CartItem[]) {
  items = next;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota — the in-memory cart still works.
  }

  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);

  // Another tab changing the cart writes to the same key.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    items = readStorage();
    emit();
  };

  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot() {
  return items;
}

export function getServerSnapshot() {
  return EMPTY;
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function addItem(item: Omit<CartItem, "quantity">, quantity = 1) {
  const cap = Math.max(1, item.stock);
  const existing = items.find((entry) => entry.productId === item.productId);

  if (!existing) {
    commit([...items, { ...item, quantity: Math.min(quantity, cap) }]);
    return;
  }

  commit(
    items.map((entry) =>
      entry.productId === item.productId
        ? { ...entry, ...item, quantity: Math.min(entry.quantity + quantity, cap) }
        : entry,
    ),
  );
}

export function setItemQuantity(productId: string, quantity: number) {
  commit(
    items.flatMap((entry) => {
      if (entry.productId !== productId) return [entry];
      if (quantity < 1) return [];
      return [{ ...entry, quantity: Math.min(quantity, Math.max(1, entry.stock)) }];
    }),
  );
}

export function removeItem(productId: string) {
  commit(items.filter((entry) => entry.productId !== productId));
}

export function clearCart() {
  commit(EMPTY);
}

/* ------------------------------------------------------------------ */

export function cartTotals(entries: CartItem[]) {
  const subtotal = entries.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping =
    entries.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

  return {
    count: entries.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}
