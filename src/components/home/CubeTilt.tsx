"use client";

import { useEffect, useRef } from "react";

/**
 * Lets the cube lean toward the cursor.
 *
 * A progressive enhancement, and a small one: the cube turns on its own with
 * no script at all, and this only adds a lean of a few degrees toward wherever
 * the pointer is over the hero. Enough that the object answers when looked
 * at, not enough that it follows anyone around.
 *
 * Written to two custom properties on the wrapper rather than to a transform,
 * so the lean composes with the turn the stylesheet already runs — a JS
 * transform on the same element as a CSS animation would fight it and lose.
 * The properties are read by `.cube-tilt` in `globals.css`, which also owns
 * the easing; this component knows nothing about how the lean looks.
 *
 * Off for a touch screen, where there is no pointer to lean toward and the
 * event fires once per tap; off for reduced motion, where the cube is already
 * still. Both are checked once, with a media query, rather than per event.
 */
export function CubeTilt({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || still.matches) return;

    // The hero band, so the lean starts as the pointer enters the section
    // rather than only over the cube's own box.
    const field = node.closest("section") ?? node.parentElement;
    if (!field) return;

    let frame = 0;

    const onMove = (event: PointerEvent) => {
      const rect = field.getBoundingClientRect();
      // −1 … 1 across the band in each axis, from the pointer's position.
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Up to 10° about each axis; leaning toward the pointer means the
        // top tips back as the pointer goes up, hence the sign on `y`.
        node.style.setProperty("--tilt-x", `${(-y * 10).toFixed(2)}deg`);
        node.style.setProperty("--tilt-y", `${(x * 10).toFixed(2)}deg`);
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      node.style.setProperty("--tilt-x", "0deg");
      node.style.setProperty("--tilt-y", "0deg");
    };

    field.addEventListener("pointermove", onMove);
    field.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      field.removeEventListener("pointermove", onMove);
      field.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={ref} className="cube-tilt">
      {children}
    </div>
  );
}
