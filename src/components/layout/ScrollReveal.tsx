"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Anything marked `reveal` fades up as it scrolls into view.
 *
 * One observer for the whole storefront rather than a wrapper component
 * per block: a server component can then say `className="reveal"` on a
 * heading or a card and be done, and the pages read as pages rather than
 * as trees of `<Reveal>`. Elements that arrive later — the next page,
 * cards fetched for the wishlist panel — are picked up by a mutation
 * observer, and everything on screen at load is shown at once, so nothing
 * above the fold waits on a scroll that is not coming.
 *
 * Reveals once and lets go: a section that faded in on the way down does
 * not fade out on the way back up. Renders nothing itself.
 */
export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      document
        .querySelectorAll<HTMLElement>(".reveal, .reveal-view")
        .forEach((el) => (el.dataset.shown = "true"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "true";
          observer.unobserve(entry.target);
        }
      },
      // A little before the fold, so the motion has finished by the time
      // the block is fully in view rather than starting then.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    const watch = (root: ParentNode) => {
      root
        .querySelectorAll<HTMLElement>(".reveal:not([data-shown]), .reveal-view:not([data-shown])")
        .forEach((el) => observer.observe(el));
    };
    watch(document);

    const added = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (
            (node.classList.contains("reveal") || node.classList.contains("reveal-view")) &&
            !node.dataset.shown
          )
            observer.observe(node);
          watch(node);
        }
      }
    });
    added.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      added.disconnect();
    };
    // Re-armed on navigation: the new page's blocks are new nodes, and the
    // mutation observer would catch them, but a fresh pass is cheaper to
    // reason about than trusting the order the router inserts them in.
  }, [pathname]);

  return null;
}
