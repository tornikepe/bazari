"use client";

import { useState } from "react";

/**
 * A number that goes up whenever `value` changes, and never on first render.
 *
 * Used as a `key` to replay a CSS animation: remounting the element restarts
 * it, which is the only way to run the same animation twice without waiting
 * for it to finish and clearing a class.
 *
 * The comparison happens *during* render rather than in an effect. Adjusting
 * state while rendering is React's own answer to "derive from a prop that
 * changed" — it re-runs this component immediately, before anything is
 * painted, so there is no frame showing the old value and no cascading
 * render for the linter to object to.
 *
 * Zero on the first render on purpose: the badge appearing at all is already
 * the signal. `ready` is for values that arrive late — a cart read out of
 * storage after hydration is not a change somebody made.
 */
export function useChangeKey(value: unknown, ready = true): number {
  const [seen, setSeen] = useState(value);
  const [armed, setArmed] = useState(ready);
  const [key, setKey] = useState(0);

  if (!armed && ready) {
    /* The first value that counts is adopted rather than reacted to.
     *
     * The cart is read from `localStorage` after hydration, so its count goes
     * 0 → 3 on the first client render of a page loaded with a full basket.
     * That is not a change the shopper made, and bouncing the badge on every
     * page load is motion for its own sake. */
    setArmed(true);
    setSeen(value);
  } else if (armed && !Object.is(seen, value)) {
    setSeen(value);
    setKey(key + 1);
  }

  return key;
}
