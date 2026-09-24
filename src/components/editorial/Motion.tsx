"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

/**
 * The storefront's motion: inertial scrolling that settles on sections,
 * and a cursor.
 *
 * Lenis smooths the wheel — the page keeps moving a little after the wheel
 * stops, which is what makes a long page of photographs feel like one
 * surface rather than a document jumping in steps. It had stops for a
 * while, sections a scroll ending nearby was eased onto; they read as the
 * page pulling against the hand, and are gone. The inertia is the
 * reference's (lerp 0.085) and nothing fights it.
 *
 * A finger keeps the phone's own scrolling (`syncTouch` off): fighting
 * it is the one thing no site of this kind survives. The cursor is a
 * dot that follows the pointer and grows over anything pressable, under
 * a fine pointer only. Everything stands down for anyone who has asked
 * for less motion. Renders the dot and nothing else.
 */
export function Motion() {
  const pathname = usePathname();

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const root = document.documentElement;

    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    /* A new page starts at its top. The router scrolls there itself, but
       the previous page's inertia was still running through the change —
       a wheel flick followed by "buy now" carried the checkout 200px down
       before this instance had even been made — so the arrival is said
       again here, at once. Not on back and forward, where the browser is
       restoring where the reader was. */
    const arrived = sessionStorage.getItem("bz-nav") !== "pop";
    sessionStorage.removeItem("bz-nav");
    if (arrived && !location.hash) lenis.scrollTo(0, { immediate: true, force: true });
    const pop = () => sessionStorage.setItem("bz-nav", "pop");
    window.addEventListener("popstate", pop);

    let move: ((event: PointerEvent) => void) | null = null;
    let leave: (() => void) | null = null;
    if (fine) {
      move = (event: PointerEvent) => {
        root.style.setProperty("--cx", `${event.clientX}px`);
        root.style.setProperty("--cy", `${event.clientY}px`);
        if (!root.dataset.cursor) root.dataset.cursor = "on";
        /* Three states, not two. Over something to press, the dot grows;
           over a box being typed in it goes away altogether, because a
           black disc sitting on the caret while a password is typed is
           the pointer competing with the field for the same spot. */
        const target = event.target as Element | null;
        const typing = target?.closest(
          "input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]), textarea, select, [contenteditable=''], [contenteditable='true']",
        );
        const press = target?.closest("a, button, [role=button], label");
        const dot = document.querySelector<HTMLElement>(".cursor-dot");
        if (dot) dot.dataset.over = typing ? "text" : press ? "link" : "";
      };
      leave = () => delete root.dataset.cursor;
      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("mouseleave", leave);
    }

    return () => {
      /* Stopped before the next page renders, so nothing from this one is
         still writing the scroll position while the router moves it. */
      cancelAnimationFrame(frame);
      lenis.stop();
      lenis.destroy();
      window.removeEventListener("popstate", pop);
      if (move) window.removeEventListener("pointermove", move);
      if (leave) document.removeEventListener("mouseleave", leave);
      delete root.dataset.cursor;
    };
    // Re-made on navigation, so a page that changes height starts clean.
  }, [pathname]);

  return <div className="cursor-dot" aria-hidden="true" />;
}
