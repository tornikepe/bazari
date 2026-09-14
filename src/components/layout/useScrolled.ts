"use client";

import { useEffect, useState } from "react";

/**
 * Whether the page has moved under the header.
 *
 * One boolean, flipped past a small threshold, so the header's glass state
 * is a state and not a value that flickers around the first pixel of
 * scroll. Read on a `requestAnimationFrame` behind a passive listener.
 */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return scrolled;
}
