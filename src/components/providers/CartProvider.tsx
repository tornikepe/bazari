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
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/cart-rules";

export type { CartItem };
export { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE };

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

const CartContext = createContext<CartValue | null>(null);

/** Never notifies — the value only differs between server and client. */
function subscribeNever() {
  return () => {};
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const value = useMemo<CartValue>(
    () => ({
      items,
      hydrated,
      ...cartTotals(items),
      add: addItem,
      setQuantity: setItemQuantity,
      remove: removeItem,
      clear: clearCart,
    }),
    [items, hydrated],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart() {
  const value = use(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>");
  return value;
}
