"use client";

import { createContext, use, useMemo, useSyncExternalStore } from "react";
import {
  addItem,
  cartTotals,
  clearCart,
  getServerSnapshot,
  getSnapshot,
  removeItem,
  setItemQuantity,
  subscribe,
  type CartItem,
} from "@/lib/cart-store";
import { useSettings } from "@/components/providers/SettingsProvider";

export type { CartItem };

type CartValue = {
  items: CartItem[];
  /** False during SSR and the hydration pass — guards cart-dependent UI. */
  hydrated: boolean;
  count: number;
  subtotal: number;
  shipping: number;
  total: number;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Never notifies — the value only differs between server and client. */
function subscribeNever() {
  return () => {};
}

/** What the provider hands down: the live cart, and the cart as the server saw it. */
type CartContextValue = { live: CartValue; server: CartValue };

export function CartProvider({ children }: { children: React.ReactNode }) {
  // The shipping rules are configuration now, not constants this module can
  // import, so they arrive from the provider above.
  const settings = useSettings();
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo<CartContextValue>(() => {
    const actions = {
      add: addItem,
      setQuantity: setItemQuantity,
      remove: removeItem,
      clear: clearCart,
    };
    const empty = getServerSnapshot();
    return {
      live: { items, hydrated: true, ...cartTotals(items, settings), ...actions },
      server: { items: empty, hydrated: false, ...cartTotals(empty, settings), ...actions },
    };
  }, [items, settings]);

  return <CartContext value={value}>{children}</CartContext>;
}

/**
 * The cart, as the calling component may show it.
 *
 * Whether the component has hydrated is read *here*, in the component that
 * asks, and not once in the provider. The provider hydrates first and
 * switches to the real cart; a component inside a Suspense boundary that
 * streams in later — the header is one — then hydrated against server HTML
 * drawn with no cart while holding a cart with two things in it, and React
 * threw the boundary away and redrew it. Until this component has hydrated
 * it gets the cart the server had, which is empty, and matches.
 */
export function useCart(): CartValue {
  const value = use(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return hydrated ? value.live : value.server;
}
