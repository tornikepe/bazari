"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/**
 * A figure that counts up to itself when it first appears.
 *
 * The server prints the final value, invisible, so the number is in the
 * page from the first byte and a screen reader has it at once; on arrival
 * the client shows it and runs it from zero over most of a second on a
 * curve that starts fast and settles. Someone who has asked for less
 * motion gets the final value with no run-up.
 *
 * `kind` says how to write it — whole numbers with the locale's grouping,
 * or money through `formatPrice` — because a formatting function cannot
 * cross from a server component to this one.
 */
export function CountUp({
  value,
  kind = "int",
  locale = "ka",
  duration = 900,
  className = "",
}: {
  value: number;
  kind?: "int" | "money";
  locale?: Locale;
  /** Milliseconds for the whole run. */
  duration?: number;
  className?: string;
}) {
  // `null` until the client has taken over; then the fraction reached.
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    // Every step, the first included, is set from a frame callback rather
    // than from the effect itself — a state set inside an effect re-renders
    // before the frame is painted.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // A tab in the background gets no frames; the figure would sit at
      // nothing until the tab was looked at. It is set in full instead.
      const t =
        still || document.visibilityState === "hidden" ? 1 : Math.min(1, (now - start) / duration);
      // Ease-out cubic: most of the distance in the first third, then a settle.
      setProgress(1 - (1 - t) ** 3);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const shown = Math.round(value * (progress ?? 1));
  const text =
    kind === "money"
      ? formatPrice(shown, locale)
      : new Intl.NumberFormat(locale === "ka" ? "ka-GE" : "en-GB").format(shown);

  return (
    <span className={`tabular-nums ${progress === null ? "count-up-pending" : ""} ${className}`}>
      {text}
    </span>
  );
}
