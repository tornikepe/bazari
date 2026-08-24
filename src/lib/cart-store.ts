/**
 * The cart lives in localStorage, which makes it an *external store* rather
 * than React state. Modelling it as one (and reading it through
 * `useSyncExternalStore`) means no mount effect is needed to hydrate it, and
 * React handles the server/client snapshot difference itself.
 *
 * It also gets cross-tab sync for free via the `storage` event.
 */
import { shippingFor, type ShippingRules } from "@/lib/cart-rules";

export type CartItem = {
  productId: string;
  slug: string;
  nameKa: string;
  nameEn: string;
  image: string;
  price: number;
  stock: number;
  quantity: number;
  /**
   * Which combination, for a product sold in more than one form.
   *
   * Absent for everything else, which is most things — a product with no
   * options has no variants, and a cart line for it is exactly the shape it
   * was before any of this existed.
   */
  variantId?: string;
  /** What that combination is called — "M · Red" — snapshotted for the line. */
  variantLabel?: string;
};

/**
 * What makes two lines the same line.
 *
 * The product *and* the combination. A cart holding one red medium and one
 * blue medium is holding two things, and merging them on the product id alone
 * would quietly deliver two of whichever was added second.
 */
export function lineKey(item: { productId: string; variantId?: string }): string {
  return item.variantId ? `${item.productId}:${item.variantId}` : item.productId;
}

// v2: prices moved from lari to tetri. A v1 cart read under the new rules
// would price a ₾149 item at ₾1.49, so the key is bumped rather than migrated
// — an abandoned cart is not worth a migration path.
const STORAGE_KEY = "bazari.cart.v2";

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
  const key = lineKey(item);
  const existing = items.find((entry) => lineKey(entry) === key);

  if (!existing) {
    commit([...items, { ...item, quantity: Math.min(quantity, cap) }]);
    return;
  }

  commit(
    items.map((entry) =>
      lineKey(entry) === key
        ? { ...entry, ...item, quantity: Math.min(entry.quantity + quantity, cap) }
        : entry,
    ),
  );
}

export function setItemQuantity(key: string, quantity: number) {
  commit(
    items.flatMap((entry) => {
      if (lineKey(entry) !== key) return [entry];
      if (quantity < 1) return [];
      return [{ ...entry, quantity: Math.min(quantity, Math.max(1, entry.stock)) }];
    }),
  );
}

export function removeItem(key: string) {
  commit(items.filter((entry) => lineKey(entry) !== key));
}

export function clearCart() {
  commit(EMPTY);
}

/* ------------------------------------------------------------------ */

export function cartTotals(entries: CartItem[], rules?: ShippingRules) {
  const subtotal = entries.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = shippingFor(subtotal, entries.length, rules);

  return {
    count: entries.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}
