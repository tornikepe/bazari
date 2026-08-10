"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

export type OverlayState = "open" | "closed";

/**
 * Keeps an overlay mounted long enough to animate away.
 *
 * A panel written as `{open && <Drawer />}` can only ever animate in. The
 * moment `open` goes false React removes the node, so the closing transition
 * has nothing left to run on and the drawer vanishes — which is the half of
 * the interaction people actually notice, because by then they are looking
 * straight at it.
 *
 * So this separates the two questions a transition needs answered:
 *
 *   `mounted` — is the node in the tree? True as soon as it opens, false only
 *               once the exit transition has had its time.
 *   `state`   — which end of the transition is it at? Drives `data-state`,
 *               which the CSS keys off.
 *
 * ## Why there is no frame-scheduling here
 *
 * The obvious implementation mounts the panel closed and then flips it open a
 * frame later, so the browser has two styles to interpolate between. That does
 * not work: React batches the update that mounts the node with the one that
 * opens it into a single commit, so the panel's very first computed style is
 * already the open one. Every drawer snapped fully open with no
 * `transitionstart` ever firing — while the CSS read perfectly correctly in
 * devtools, `transform` and `0.34s` both present, with nothing to apply them
 * to. Working around it meant a forced layout read inside a layout effect,
 * which is a lot of machinery for "slide in".
 *
 * CSS answers this directly. `@starting-style` in globals.css declares the
 * style an overlay transitions *from* on first paint, so the panel can render
 * straight into its open state and the browser supplies the other end. That
 * leaves this hook with one job — holding the node during the exit — and no
 * scheduling at all.
 *
 * `duration` must be at least as long as the CSS exit transition, or the node
 * is pulled out from under it.
 */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useOverlay(
  open: boolean,
  {
    duration = 320,
    lockScroll = false,
    onEscape,
    trapFocusIn,
  }: {
    duration?: number;
    lockScroll?: boolean;
    onEscape?: () => void;
    /**
     * The element to hold focus inside while open. Supplying it turns the
     * overlay modal for the keyboard as well as for the mouse.
     */
    trapFocusIn?: RefObject<HTMLElement | null>;
  } = {},
) {
  const [mounted, setMounted] = useState(open);

  // Adjusted during render rather than in an effect. The node has to enter the
  // tree in the same commit that opens it — an effect would insert it a frame
  // later, and React re-runs the component immediately on a render-phase
  // update rather than committing the stale value first.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setMounted(true);
  }

  const state: OverlayState = open ? "open" : "closed";

  useEffect(() => {
    if (open || !mounted) return;

    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [open, mounted, duration]);

  // Held for as long as the node exists, not just while `open` — releasing it
  // the instant a close begins lets the page jump behind a panel that is still
  // on screen sliding away.
  useEffect(() => {
    if (!mounted || !lockScroll) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted, lockScroll]);

  useEffect(() => {
    if (!open || !onEscape) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onEscape]);

  // --- focus ---------------------------------------------------------
  //
  // A drawer that traps the pointer and not the keyboard is not modal, it just
  // looks it: tab once and the caret is out in the page behind the scrim,
  // moving through links nobody can see. Three things have to happen, and the
  // last is the one usually forgotten.
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = trapFocusIn?.current;
    if (!open || !container) return;

    // 1. Remember where the keyboard was, so it can be put back.
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // 2. Move into the *panel*, not merely into the container. The scrim is
    //    the first focusable thing inside the container, so focusing "the first
    //    focusable" landed the keyboard on Close — a drawer that opens with
    //    "Close" selected reads as though it is already dismissing itself. The
    //    panel carries `tabIndex={-1}` so it can take focus when it has no
    //    controls of its own.
    const panel = container.querySelector<HTMLElement>('[role="dialog"]') ?? container;
    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel).focus();

    return () => {
      // 3. Put it back. Without this, closing a drawer drops focus onto
      //    `<body>` and the next Tab starts from the top of the document —
      //    which, for someone who opened the menu from the footer, means
      //    tabbing the whole page again to get back to where they were.
      returnTo.current?.focus();
    };
  }, [open, trapFocusIn]);

  useEffect(() => {
    const container = trapFocusIn?.current;
    if (!open || !container) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      // Read on every keypress rather than once: the drawer's contents change
      // while it is open — a filter list expands, a menu swaps its links — and
      // a list captured at open time sends focus to elements that have gone.
      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      // Only the two ends need handling; everything between is the browser's
      // own tab order, which is already correct.
      if (event.shiftKey && (active === first || active === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, trapFocusIn]);

  return { mounted, state };
}
