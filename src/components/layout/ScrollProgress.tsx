"use client";

import { useEffect, useRef } from "react";

/**
 * The thin bar along the top of the window that fills as the page is read.
 *
 * Where the browser has scroll-driven animations the bar is pure CSS
 * (`.scroll-progress` in globals.css) and this component only renders it.
 * Elsewhere it does the same sum on a scroll listener — one `requestAnimationFrame`
 * per scroll event, writing one custom property — so the bar moves in
 * every browser and the page's JavaScript is not on the hook where it
 * need not be.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()")) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const travel = root.scrollHeight - root.clientHeight;
      node.style.setProperty("--progress", travel > 0 ? String(root.scrollTop / travel) : "0");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} aria-hidden className="scroll-progress" />;
}
