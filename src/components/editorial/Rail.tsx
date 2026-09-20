"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

/**
 * A row that scrolls sideways, with an arrow at each end.
 *
 * The children are laid end to end and the row shows a little of the next
 * one past the edge, so it reads as a row that goes on. A press on an arrow
 * moves it by most of a screen, eased; the arrows dim at either end. The
 * row itself scrolls by touch and by trackpad as well — the arrows are for
 * a mouse, which has no sideways gesture of its own.
 */
export function Rail({
  children,
  label,
  className = "",
}: {
  children: React.ReactNode;
  /** What the arrows move, for a screen reader: "previous", "next". */
  label: { previous: string; next: string };
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const read = () =>
      setEdge({
        start: el.scrollLeft <= 2,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
      });
    read();
    el.addEventListener("scroll", read, { passive: true });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", read);
      ro.disconnect();
    };
  }, []);

  const move = (direction: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className={`rail ${className}`}>
      <div ref={track} className="rail-track" data-lenis-prevent>
        {children}
      </div>
      <div className="rail-arrows">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={edge.start}
          aria-label={label.previous}
          className="rail-arrow"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={edge.end}
          aria-label={label.next}
          className="rail-arrow"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>
    </div>
  );
}
