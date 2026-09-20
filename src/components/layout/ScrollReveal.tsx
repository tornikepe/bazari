"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Anything marked `reveal` fades up as it scrolls into view.
 *
 * One observer for the whole storefront rather than a wrapper component
 * per block: a server component can then say `className="reveal"` on a
 * heading or a card and be done. Elements that arrive later — the next
 * page, cards fetched for a panel — are picked up by a mutation observer.
 *
 * The motion is run with the Web Animations API rather than by setting an
 * attribute the stylesheet reacts to. An attribute written onto a block
 * that React had not yet hydrated — a page streaming in behind a Suspense
 * boundary — was a hydration mismatch on every card of the catalogue; an
 * animation on the node is not part of its markup and React never
 * compares it. The blocks start hidden only once this has run (the
 * stylesheet keys on `data-reveal` on the root), so without JavaScript
 * nothing is ever hidden.
 *
 * Reveals once and lets go: a section that faded in on the way down does
 * not fade out on the way back up. Renders nothing itself.
 */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SELECTOR = ".reveal, .reveal-view";

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Not on a touch screen either — see the stylesheet: a thumb flicks
    // faster than a reveal can follow.
    const touch = window.matchMedia("(hover: none)").matches;
    if (still || touch || typeof IntersectionObserver === "undefined") return;

    // Scroll-driven cards animate themselves where the browser can; only
    // where it cannot does the observer take them too.
    const scrollDriven = CSS.supports("animation-timeline: view()");
    const done = new WeakSet<Element>();
    root.dataset.reveal = scrollDriven ? "on" : "all";

    const show = (el: HTMLElement) => {
      if (done.has(el)) return;
      done.add(el);
      const delay = parseFloat(getComputedStyle(el).getPropertyValue("--reveal-delay")) || 0;
      el.animate(
        [
          { opacity: 0, transform: "translateY(1.5rem)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 800, delay: delay * 1000, easing: EASE, fill: "both" },
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }
      },
      // A little before the fold, so the motion has finished by the time
      // the block is fully in view rather than starting then.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );

    const wants = (el: Element) =>
      el.classList.contains("reveal") || (!scrollDriven && el.classList.contains("reveal-view"));
    const watch = (node: ParentNode) => {
      node.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (wants(el) && !done.has(el)) observer.observe(el);
      });
    };
    watch(document);

    const added = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (wants(node) && !done.has(node)) observer.observe(node);
          watch(node);
        }
      }
    });
    added.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      added.disconnect();
    };
    // Re-armed on navigation: the new page's blocks are new nodes, and a
    // fresh pass is cheaper to reason about than trusting the order the
    // router inserts them in.
  }, [pathname]);

  return null;
}
