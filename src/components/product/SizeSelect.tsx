"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon } from "@/components/ui/icons";

export type SizeChoice = { id: string; label: string; available: boolean };

/**
 * The size, as a control of the shop's own rather than the platform's.
 *
 * A native select cannot say which sizes are gone in the shop's own hand,
 * and on a phone it hands the choice to the operating system's wheel. This
 * is a button that opens a panel: every size in a row, the chosen one in
 * ink, the ones that cannot be bought struck through and unpressable, and
 * the whole thing closing on a choice, on Escape, or on a press outside.
 *
 * The panel is drawn at the end of the document and placed over the
 * button, rather than inside it. A cart line is wrapped in the box that
 * lets a thumb swipe it away, and that box hides what leaves it — so a
 * panel drawn inside the line came out with its lower half cut off. Any
 * ancestor that scrolls or clips would do the same; this way none of them
 * can. It follows the button while the page moves and closes if the
 * window is resized under it.
 */
export function SizeSelect({
  label,
  choices,
  value,
  onChange,
  soldOutLabel,
}: {
  label: string;
  choices: SizeChoice[];
  value: string | undefined;
  onChange: (id: string) => void;
  /** Said under a size that cannot be bought. */
  soldOutLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const chosen = choices.find((choice) => choice.id === value);

  /* Where the panel goes: under the button, or over it when there is no
     room below. Measured before paint so it never appears in the wrong
     place first. */
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const box = button.current?.getBoundingClientRect();
      if (!box) return;
      const room = window.innerHeight - box.bottom;
      const height = panel.current?.offsetHeight ?? 0;
      const above = room < Math.min(height || 240, 240) && box.top > room;
      setAt({
        top: above ? box.top - (height || 240) - 6 : box.bottom + 6,
        left: box.left,
        width: box.width,
      });
    };

    place();
    /* The page scrolls under an open panel — smoothly, at that — so the
       panel is moved with it rather than left hanging in the air. */
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, choices.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      const target = event.target as Node;
      if (root.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={root} className="size-select">
      <span className="field-label" id={`${id}-label`}>
        {label}
      </span>

      <button
        ref={button}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        className="size-select-button"
      >
        <span className="truncate">{chosen?.label ?? label}</span>
        <ChevronDownIcon size={18} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        createPortal(
        <div
          ref={panel}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="size-select-panel"
          style={at ? { top: at.top, left: at.left, width: at.width } : { opacity: 0 }}
        >
          {choices.map((choice) => {
            const picked = choice.id === value;
            return (
              <button
                key={choice.id}
                type="button"
                role="option"
                aria-selected={picked}
                disabled={!choice.available}
                onClick={() => {
                  onChange(choice.id);
                  setOpen(false);
                }}
                className={`size-select-option ${picked ? "is-on" : ""}`}
              >
                <span className={choice.available ? "" : "line-through"}>{choice.label}</span>
                {picked ? (
                  <CheckIcon size={15} strokeWidth={3} className="shrink-0" />
                ) : !choice.available ? (
                  <span className="text-[11px] font-semibold text-ink-400">{soldOutLabel}</span>
                ) : null}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
