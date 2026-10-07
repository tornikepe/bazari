"use client";

import { useEffect } from "react";
import { dropProducts, getSnapshot as cartSnapshot } from "@/lib/cart-store";
import { dropFavorites, getSnapshot as favouritesSnapshot } from "@/lib/favorites-store";
import { sellableProducts } from "@/app/actions/products";

/** Matches the server action's limit; the lists are sent a hundred at a time. */
const BATCH = 100;

/**
 * Clears out of the cart and the wishlist whatever the shop has stopped
 * selling.
 *
 * Both lists live in the visitor's own browser, so they can name products
 * that were withdrawn, or deleted outright, long after they were put there.
 * The pages themselves fetch what they draw and so quietly drew fewer than
 * they held; the bag and the heart in the bar count what is *held*, so they
 * were the ones that lied — a bag saying five above a cart showing three.
 *
 * Runs once a page load and does nothing visible when everything is still on
 * sale, which is nearly always. A call that fails removes nothing: a shop
 * that cannot be reached is not a shop that has withdrawn anything, and
 * emptying somebody's cart over a dropped connection is the worse mistake.
 *
 * Mounted for everyone, signed in or not. The account sync beside it only
 * runs for a customer, and a guest's cart goes stale in exactly the same way.
 */
export function StaleItemSweep() {
  useEffect(() => {
    let alive = true;

    const sweep = async () => {
      const ids = [
        ...new Set([
          ...cartSnapshot().map((item) => item.productId),
          ...favouritesSnapshot(),
        ]),
      ];
      if (ids.length === 0) return;

      for (let at = 0; at < ids.length; at += BATCH) {
        const batch = ids.slice(at, at + BATCH);
        const sellable = new Set(await sellableProducts(batch));
        if (!alive) return;

        // Only ever within the batch that was actually asked about.
        const gone = new Set(batch.filter((id) => !sellable.has(id)));
        dropProducts(gone);
        dropFavorites(gone);
      }
    };

    void sweep().catch(() => {
      // Offline, or the action refused. Nothing is removed on a failure.
    });

    return () => {
      alive = false;
    };
  }, []);

  return null;
}
