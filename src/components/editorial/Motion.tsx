"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import Snap from "lenis/snap";

/**
 * The storefront's motion: inertial scrolling that settles on sections,
 * and a cursor.
 *
 * Lenis smooths the wheel — the page keeps moving a little after the wheel
 * stops, which is what makes a long page of photographs feel like one
 * surface rather than a document jumping in steps. On top of it, the
 * sections marked `data-snap` are stops: a scroll that ends near one
 * eases the rest of the way, so the page comes to rest on the products,
 * then on the deals, then at the foot — the way the reference site
 * (pensatori-irrazionali.com) settles — instead of anywhere at all.
 * `proximity`, not `mandatory`: a scroll that ends between two stops stays
 * where it was put.
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

    /* The stops: every `data-snap` element's top, less the sticky header,
       re-read whenever the page changes height (pictures arriving, a
       section revealing). */
    const snap = new Snap(lenis, { type: "proximity", distanceThreshold: "30%", debounce: 350, lerp: 0.06 });
    let clear: (() => void)[] = [];
    const place = () => {
      clear.forEach((remove) => remove());
      clear = [];
      const header = parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) * 16 || 76;
      document.querySelectorAll<HTMLElement>("[data-snap]").forEach((el) => {
        const top = el.getBoundingClientRect().top + window.scrollY - header - 8;
        if (top > 0) clear.push(snap.add(Math.round(top)));
      });
    };
    place();
    const sized = new ResizeObserver(() => place());
    sized.observe(document.body);

    let move: ((event: PointerEvent) => void) | null = null;
    let leave: (() => void) | null = null;
    if (fine) {
      move = (event: PointerEvent) => {
        root.style.setProperty("--cx", `${event.clientX}px`);
        root.style.setProperty("--cy", `${event.clientY}px`);
        if (!root.dataset.cursor) root.dataset.cursor = "on";
        const over = (event.target as Element | null)?.closest("a, button, [role=button], input, select, textarea, label");
        const dot = document.querySelector<HTMLElement>(".cursor-dot");
        if (dot) dot.dataset.over = over ? "link" : "";
      };
      leave = () => delete root.dataset.cursor;
      window.addEventListener("pointermove", move, { passive: true });
      document.addEventListener("mouseleave", leave);
    }

    return () => {
      cancelAnimationFrame(frame);
      sized.disconnect();
      snap.destroy();
      lenis.destroy();
      if (move) window.removeEventListener("pointermove", move);
      if (leave) document.removeEventListener("mouseleave", leave);
      delete root.dataset.cursor;
    };
    // Re-made on navigation: the stops belong to the page.
  }, [pathname]);

  return <div className="cursor-dot" aria-hidden="true" />;
}
