"use client";

import { useEffect, useRef, useState } from "react";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";

/**
 * Says out loud what just happened to the cart.
 *
 * Adding something to a basket is the one action on a shop that changes state
 * without changing the page, so a screen reader is told nothing: the button
 * still says what it said, and the count in the header — which is where the
 * feedback actually lives — is nowhere near the focus.
 *
 * ## Derived rather than reported
 *
 * The cart is an external store whose mutations are plain module functions, so
 * nothing threads an "action" through React. This works out what changed by
 * comparing the new list against the last one it saw, which means it also
 * catches changes it was never told about — a quantity edited on the cart page,
 * an item removed from the drawer, a cart cleared after checkout.
 *
 * ## Why the button no longer carries `aria-live`
 *
 * It used to be on the add-to-cart button itself, whose label flips to "Added".
 * A live region on the control whose own name is changing announces the name
 * change rather than the event, and it only exists while that button is on
 * screen — so removing an item from the cart page announced nothing at all.
 * One region, owned by the cart, covers every route.
 */
export function CartAnnouncer() {
  const { items, count, hydrated } = useCart();
  const { t, locale } = useI18n();

  const [message, setMessage] = useState("");
  const previous = useRef<CartItem[] | null>(null);

  useEffect(() => {
    // The first snapshot after hydration is the cart the visitor already had,
    // not something they just did. Announcing it would greet every page load
    // with a summary of a basket filled yesterday.
    if (!hydrated) return;

    const before = previous.current;
    previous.current = items;
    if (before === null) return;

    const name = (item: CartItem) => (locale === "ka" ? item.nameKa : item.nameEn);
    const byId = new Map(before.map((item) => [item.productId, item]));

    // Emptied — checked first, because it also looks like "everything removed".
    if (items.length === 0 && before.length > 0) {
      setMessage(t.cart.cartCleared);
      return;
    }

    for (const item of items) {
      const was = byId.get(item.productId);

      if (!was) {
        setMessage(fill(t.cart.cartAdded, { name: name(item), count: String(count) }));
        return;
      }

      if (was.quantity !== item.quantity) {
        // A second "add" of something already in the basket is a quantity
        // change to the store, and "added" is what the person actually did.
        const template = item.quantity > was.quantity ? t.cart.cartAdded : t.cart.cartQuantity;
        setMessage(
          fill(template, {
            name: name(item),
            quantity: String(item.quantity),
            count: String(count),
          }),
        );
        return;
      }
    }

    const removed = before.find((item) => !items.some((kept) => kept.productId === item.productId));
    if (removed) {
      setMessage(fill(t.cart.cartRemoved, { name: name(removed), count: String(count) }));
    }
  }, [items, count, hydrated, locale, t]);

  return (
    // `role="status"` is `aria-live="polite"` plus a role, which is what a
    // change like this wants: spoken at the next pause rather than interrupting
    // whatever is being read. `aria-atomic` makes it read the whole sentence
    // instead of only the words that differ from last time.
    <p role="status" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}
