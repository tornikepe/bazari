"use client";

import { useEffect, useRef } from "react";

/**
 * The thin bar along the top of the window that fills as the page is read:
 * nothing at the top, the whole width at the bottom.
 *
 * Measured by script on every device rather than by a CSS scroll timeline.
 * The timeline was the lighter way, but "the bottom" is not the same thing
 * to every engine — a phone browser's collapsing toolbar changes the
 * viewport as it scrolls, and the timeline's end would stop a few pixels
 * short of full — so the sum is done here with the numbers the page really
 * has: how far it has scrolled, over how far it can. One frame per scroll
 * event, one custom property written, and the width is a transform, which
 * costs no layout.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.scrollingElement ?? document.documentElement;
      // The visual viewport where there is one: on a phone the browser's
      // toolbar collapses and grows as the page scrolls, and `innerHeight`
      // lags behind what is actually on screen.
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const scrolled = root.scrollTop;
      const travel = root.scrollHeight - viewport;
      // Within two pixels of the end is the end: a bar 99.7% full reads as
      // a bar that did not make it, and a phone's rounding lands there.
      const progress =
        travel <= 0
          ? 0
          : travel - scrolled < 2
            ? 1
            : Math.min(1, Math.max(0, scrolled / travel));
      node.style.setProperty("--progress", progress.toFixed(4));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    // The page grows after load — images, streamed sections, a chat panel
    // — and every change to its height changes what "the bottom" is.
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    observer?.observe(document.body);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} aria-hidden className="scroll-progress" />;
}
