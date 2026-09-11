"use client";

import { useEffect, useRef } from "react";
import { getSnapshot, subscribe } from "@/lib/cart-store";
import { saveCartSnapshot } from "@/app/actions/cart";

/**
 * Keeps a copy of a signed-in shopper's cart on the server, so a cart left
 * behind can be written about the next day.
 *
 * The cart itself stays in the browser. This sends its ids and quantities
 * up a couple of seconds after the last change — debounced, because a
 * shopper pressing "+" four times is one cart, not four — and sends an empty
 * list when it empties, which the server reads as "nothing to remind about".
 * Renders nothing; only mounted for a customer.
 */
export function CartSync() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef<string>("");

  useEffect(() => {
    const send = () => {
      const items = getSnapshot().map((item) => ({
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        quantity: item.quantity,
      }));
      const key = JSON.stringify(items);
      if (key === last.current) return;
      last.current = key;
      void saveCartSnapshot(items);
    };

    // Once on arrival, so a cart filled before signing in is on the server
    // from the first page after it.
    send();

    const unsubscribe = subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(send, 2_000);
    });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      unsubscribe();
    };
  }, []);

  return null;
}
