"use client";

import { useRef, useState } from "react";
import { TrashIcon } from "@/components/ui/icons";

/**
 * A card that can be swiped off the list with a thumb.
 *
 * Dragging to the left lifts a red field with a bin on it from under the
 * card; past a third of the card's width the drag is a decision, and
 * letting go slides the card off and folds its space away before the row
 * is actually removed — so the list settles rather than jumping. A drag
 * that does not get that far springs back.
 *
 * Only for touch: a pointer has the cross at the card's corner, and a
 * mouse that drags across a page usually means to select text.
 */
export function SwipeAway({
  onRemove,
  label,
  className = "",
  children,
}: {
  onRemove: () => void;
  /** What the red field says it will do, for a screen reader. */
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [going, setGoing] = useState(false);
  /* The same figure in a ref: `touchend` runs in the same tick as the
     last `touchmove` when the events arrive together, and a handler
     reading state would see the value from before the drag. */
  const pulled = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);
  const root = useRef<HTMLDivElement>(null);

  function width() {
    return root.current?.offsetWidth ?? 320;
  }

  return (
    <div className={`swipe ${going ? "is-going" : ""} ${className}`} ref={root}>
      {/* What the swipe reveals: it lives under the card and does not move. */}
      <div className="swipe-under" aria-hidden="true">
        <TrashIcon size={18} />
      </div>

      <div
        className="swipe-top"
        style={offset ? { transform: `translateX(${offset}px)`, transition: "none" } : undefined}
        onTouchStart={(event) => {
          const touch = event.touches[0] ?? event.changedTouches[0];
          if (!touch) return;
          start.current = { x: touch.clientX, y: touch.clientY };
          horizontal.current = null;
        }}
        onTouchMove={(event) => {
          if (!start.current) return;
          const touch = event.touches[0] ?? event.changedTouches[0];
          if (!touch) return;
          const dx = touch.clientX - start.current.x;
          const dy = touch.clientY - start.current.y;

          /* Which way this gesture is going is decided once, on the first
             few pixels: a thumb scrolling the page must not drag cards
             sideways, and a card being dragged must not scroll the page. */
          if (horizontal.current === null) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            horizontal.current = Math.abs(dx) > Math.abs(dy);
          }
          if (!horizontal.current) return;

          // Left only, and the last part of the pull comes slower.
          const raw = Math.min(0, dx);
          const eased = raw < -width() * 0.6 ? -width() * 0.6 + (raw + width() * 0.6) * 0.3 : raw;
          pulled.current = eased;
          setOffset(eased);
        }}
        onTouchEnd={() => {
          const far = pulled.current < -width() / 3;
          start.current = null;
          horizontal.current = null;
          pulled.current = 0;
          if (!far) {
            setOffset(0);
            return;
          }
          /* Off the screen, then the space folds away, then the row is
             removed — see `.swipe.is-going` in the stylesheet. */
          setOffset(0);
          setGoing(true);
          window.setTimeout(onRemove, 320);
        }}
        onTouchCancel={() => {
          start.current = null;
          horizontal.current = null;
          pulled.current = 0;
          setOffset(0);
        }}
      >
        {children}
      </div>

      <span className="sr-only">{label}</span>
    </div>
  );
}
