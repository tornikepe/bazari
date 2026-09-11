"use client";

import { useEffect, useRef } from "react";
import {
  getSnapshot,
  readSynced,
  replaceFavorites,
  subscribe,
  writeSynced,
} from "@/lib/favorites-store";
import { clearFavoritesOnAccount, setFavorite, syncFavorites } from "@/app/actions/favorites";

/**
 * Keeps a signed-in shopper's wishlist on their account as well as in their
 * browser.
 *
 * The browser's list stays the one the page reads — it works signed out, it
 * needs no round trip to draw a heart, and it already syncs across tabs. This
 * does two things beside it.
 *
 * On arrival it works out what changed here since the account last answered
 * — the store, against the record `writeSynced` keeps of what the account
 * confirmed — and sends exactly that difference up. The answer is the
 * account's whole list, which becomes the store: hearts pressed before signing
 * in are kept, hearts pressed on another device come back, and a heart
 * unpressed just before a tab closed stays unpressed rather than being merged
 * back in.
 *
 * After that, every change to the store is diffed against the last list the
 * account confirmed and written up one heart at a time; the record is only
 * advanced when a write has answered, so a write lost to a closing tab is
 * simply sent again next time.
 *
 * Renders nothing, and is only mounted for a customer: the server decides
 * that, so a guest's browser never makes a call the action would refuse.
 */
export function FavoritesSync() {
  /* What the account has confirmed, as the store's ids. Null until the first
     sync answers — before that there is nothing to diff a change against, and
     the sync itself picks up whatever happens in the meantime. */
  const confirmed = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;

    const confirm = (id: string, on: boolean) => {
      const set = confirmed.current ?? new Set<string>();
      if (on) set.add(id);
      else set.delete(id);
      confirmed.current = set;
      writeSynced([...set]);
    };

    (async () => {
      const sent = getSnapshot();
      const known = new Set(readSynced());
      const sentSet = new Set(sent);

      const account = await syncFavorites({
        add: sent.filter((id) => !known.has(id)),
        remove: [...known].filter((id) => !sentSet.has(id)),
      });
      if (!alive || account === null) return;

      /* Reconciled against the store as it is *now*, not replaced with the
         answer. The round trip takes a moment, and a heart unpressed in that
         moment is not in the answer's past — writing the answer over the
         store would press it back. */
      const now = new Set(getSnapshot());

      /* Cleared while we waited. The clear button means "everything", and
         "everything" includes what the answer is about to bring back — so the
         answer loses, here and on the account. */
      if (now.size === 0 && sent.length > 0) {
        confirmed.current = new Set();
        writeSynced([]);
        void clearFavoritesOnAccount();
        return;
      }

      const removedMeanwhile = sent.filter((id) => !now.has(id));
      const addedMeanwhile = [...now].filter((id) => !sentSet.has(id));

      const final = [
        ...account.filter((id) => !removedMeanwhile.includes(id)),
        ...addedMeanwhile.filter((id) => !account.includes(id)),
      ];

      // The store first, while `confirmed` is still null: the replacement
      // wakes the subscriber below, which must not treat the reconciliation
      // as a second round of changes to send.
      replaceFavorites(final);
      confirmed.current = new Set(account);
      writeSynced(account);

      for (const id of removedMeanwhile) void setFavorite(id, false).then(() => confirm(id, false));
      for (const id of addedMeanwhile) void setFavorite(id, true).then(() => confirm(id, true));
    })();

    const unsubscribe = subscribe(() => {
      if (!confirmed.current) return;

      const next = new Set(getSnapshot());
      const before = confirmed.current;
      const added = [...next].filter((id) => !before.has(id));
      const removed = [...before].filter((id) => !next.has(id));

      // Everything gone at once is the clear button, and one delete says so
      // better than a dozen.
      if (next.size === 0 && removed.length > 1) {
        void clearFavoritesOnAccount().then(() => {
          confirmed.current = new Set();
          writeSynced([]);
        });
        return;
      }
      for (const id of added) void setFavorite(id, true).then(() => confirm(id, true));
      for (const id of removed) void setFavorite(id, false).then(() => confirm(id, false));
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  return null;
}
