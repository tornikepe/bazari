"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const chosen = choices.find((choice) => choice.id === value);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
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

      {open && (
        <div role="listbox" aria-labelledby={`${id}-label`} className="size-select-panel">
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
        </div>
      )}
    </div>
  );
}
