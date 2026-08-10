"use client";

import { useRef } from "react";
import { useOverlay } from "@/lib/use-overlay";

/**
 * Scrim plus sliding panel — the shape every drawer on the site has.
 *
 * The scrim is a button rather than a div: dismissing by tapping outside is a
 * real control and should be reachable without a mouse. It carries the close
 * label so a screen reader announces what it does instead of "button".
 */
export function Overlay({
  open,
  onClose,
  side,
  closeLabel,
  label,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  side: "left" | "right" | "bottom";
  closeLabel: string;
  /**
   * What this drawer is, announced when it opens.
   *
   * Required rather than optional: `role="dialog"` without a name is announced
   * as "dialog" and nothing else, which is less useful than no role at all.
   */
  label: string;
  /** Extra classes for the panel — size and chrome, not motion. */
  className?: string;
  children: React.ReactNode;
}) {
  // The whole overlay, scrim included — the scrim is the "tap outside to
  // close" control and is deliberately a button, so trapping to the panel
  // alone would make it the one control a keyboard cannot reach.
  const containerRef = useRef<HTMLDivElement>(null);

  // Matches the longest CSS exit transition in `.overlay-panel`.
  const { mounted, state } = useOverlay(open, {
    duration: 340,
    lockScroll: true,
    onEscape: onClose,
    trapFocusIn: containerRef,
  });

  if (!mounted) return null;

  const anchor =
    side === "bottom" ? "inset-x-0 bottom-0" : side === "right" ? "inset-y-0 right-0" : "inset-y-0 left-0";

  return (
    <div ref={containerRef} className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        data-state={state}
        className="overlay-scrim absolute inset-0 bg-scrim"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // Focus lands here when the drawer has nothing focusable of its own,
        // which is what keeps the keyboard from staying out on the page behind.
        tabIndex={-1}
        data-state={state}
        data-side={side}
        className={`overlay-panel absolute flex flex-col ${anchor} ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A menu anchored to the control that opened it.
 *
 * Same mount/unmount contract as `Overlay`, but no scrim and no scroll lock —
 * a popover is not modal, and locking the page for a four-item menu is the
 * kind of thing that makes a site feel like it is fighting you.
 */
export function Popover({
  open,
  align = "right",
  className = "",
  children,
  ...rest
}: {
  open: boolean;
  align?: "left" | "right";
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { mounted, state } = useOverlay(open, { duration: 180 });

  if (!mounted) return null;

  return (
    <div
      {...rest}
      data-state={state}
      data-align={align}
      className={`popover-panel absolute z-50 ${align === "right" ? "right-0" : "left-0"} ${className}`}
    >
      {children}
    </div>
  );
}
