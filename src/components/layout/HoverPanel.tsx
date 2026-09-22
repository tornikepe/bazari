"use client";

import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Popover } from "@/components/ui/Overlay";

/**
 * A child can pin the panel open — the sign-in form does while it is
 * being filled and after a wrong password, so the answer is not swept
 * away by a pointer that strayed off the panel.
 */
const PinContext = createContext<((pinned: boolean) => void) | null>(null);

export function useHoverPanelPin() {
  return use(PinContext);
}

/**
 * A panel that opens under a header control while the pointer rests on
 * either, and stays put while the pointer crosses the gap between them.
 *
 * Only for a pointer that can hover: on a touch screen the control is a
 * link and behaves as one, since a panel that opened on the first tap and
 * navigated on the second would make every visit to the cart two taps. The
 * control opens it on keyboard focus too, and the panel's own controls are
 * in the tab order after it; leaving both closes it, as does Escape and a
 * change of page.
 *
 * Two short delays make it feel intended rather than twitchy: the panel
 * opens after the pointer has settled for a moment, so sweeping across the
 * header does not flash three panels, and closes a moment after the pointer
 * leaves, so a pointer that strays a pixel outside on its way into the panel
 * does not lose it.
 */
export function HoverPanel({
  trigger,
  label,
  className = "",
  width = "w-[22rem]",
  align = "right",
  children,
}: {
  trigger: ReactNode;
  /** The panel's accessible name. */
  label: string;
  className?: string;
  /** The panel's width class: a list of orders wants more than a list of links. */
  width?: string;
  /** Which edge of the control the panel hangs from. Right, for the icons
      at the end of the bar; left, for a link at the start of a row. */
  align?: "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const read = () => setCanHover(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  // A new page under the pointer should not keep the old page's panel.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /* Pinned, the pointer leaving is not enough to close it — a press
     somewhere else is. */
  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pinned]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const later = (next: boolean, delay: number) => {
    if (!next && pinned) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  };

  const pin = useMemo(
    () => (next: boolean) => {
      setPinned(next);
      if (next) {
        if (timer.current) clearTimeout(timer.current);
        setOpen(true);
      }
    },
    [],
  );

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && canHover) later(true, 70);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") later(false, 180);
      }}
      onFocus={() => {
        if (canHover) later(true, 0);
      }}
      onBlur={(event) => {
        /* Focus that went nowhere — a button disabled the moment it was
           pressed — is not focus that left the panel. */
        if (!event.relatedTarget) return;
        if (!rootRef.current?.contains(event.relatedTarget as Node)) later(false, 0);
      }}
    >
      {trigger}
      <Popover
        open={open}
        align={align}
        role="region"
        aria-label={label}
        className={`mt-2 ${width} max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-line bg-surface shadow-pop`}
      >
        <PinContext value={pin}>{children}</PinContext>
      </Popover>
    </div>
  );
}
