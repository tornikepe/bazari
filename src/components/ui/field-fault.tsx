"use client";

import { useEffect } from "react";

/**
 * A field told it is wrong, without a sentence under the form.
 *
 * The auth forms used to answer a bad submit with a red box above the button
 * — "wrong email or password", "passwords do not match" — while the fields
 * themselves sat there unchanged. The owner asked for the coupon box's
 * manner everywhere: the field turns red and shakes, and nothing has to be
 * read. Sighted, that is the whole message; the words are kept for a screen
 * reader only, in `FormFault` below.
 *
 * Web Animations rather than a class, because the same field has to shake
 * again on the next failed attempt, and a class that is already on an
 * element does not replay. `animate()` runs every time it is called.
 */
export function shakeField(element: HTMLElement | null | undefined) {
  if (!element) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  element.animate(
    [
      { transform: "translateX(0)", boxShadow: "0 0 0 0 var(--color-danger-soft)" },
      { transform: "translateX(-6px)", boxShadow: "0 0 0 6px var(--color-danger-soft)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0)", boxShadow: "0 0 0 3px var(--color-danger-soft)" },
    ],
    { duration: 440, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
  );
}

/**
 * Shakes the named fields whenever `attempt` changes while `active`.
 *
 * `attempt` is the thing that is new on every submit — the state object a
 * Server Action returns, or a counter — so two wrong passwords in a row
 * shake twice. Fields are named by id because that is what the labels
 * already use; a ref per field across six forms bought nothing.
 */
export function useFieldShake(attempt: unknown, active: boolean, ids: string[]) {
  useEffect(() => {
    if (!active) return;
    for (const id of ids) shakeField(document.getElementById(id));
    // `ids` is a fresh array each render; the fields it names do not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, active]);
}

/**
 * The words, for whoever cannot see the red.
 *
 * Announced when it appears — `alert` — and otherwise off-screen. Rendering
 * nothing at all would leave a screen-reader user with a form that silently
 * refuses.
 */
export function FormFault({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="sr-only">
      {message}
    </p>
  );
}
