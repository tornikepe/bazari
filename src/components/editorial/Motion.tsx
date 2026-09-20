"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * The storefront's motion: inertial scrolling and a cursor.
 *
 * Lenis smooths the wheel — the page keeps moving a little after the
 * finger or the wheel stops, which is what makes a long page of
 * photographs feel like one surface rather than a document jumping in
 * steps. Only under a fine pointer; a phone's own scrolling is already
 * this, and fighting it is the one thing no site of this kind survives.
 *
 * The cursor is a dot that follows the pointer, written as two custom
 * properties the stylesheet positions from, and grows over anything that
 * can be pressed. Both stand down for anyone who has asked for less
 * motion. Renders the dot and nothing else.
 */
export function Motion() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || still) return;

    const root = document.documentElement;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    const move = (event: PointerEvent) => {
      root.style.setProperty("--cx", `${event.clientX}px`);
      root.style.setProperty("--cy", `${event.clientY}px`);
      if (!root.dataset.cursor) root.dataset.cursor = "on";
      const over = (event.target as Element | null)?.closest("a, button, [role=button], input, select, textarea, label");
      const dot = document.querySelector<HTMLElement>(".cursor-dot");
      if (dot) dot.dataset.over = over ? "link" : "";
    };
    const leave = () => delete root.dataset.cursor;
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseleave", leave);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseleave", leave);
      delete root.dataset.cursor;
    };
  }, []);

  return <div className="cursor-dot" aria-hidden="true" />;
}
