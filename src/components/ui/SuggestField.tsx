"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A text box that offers completions under it as you type — the city box
 * at checkout, the address box with the addresses already saved. Arrow
 * keys move through the list, Enter takes one, Escape closes it; a click
 * outside closes it too. The suggestions come from the caller, from
 * whatever it knows.
 *
 * The box is the caller's — its value, its change — so it fits a form
 * that keeps its own state, and the list is only ever a way of typing
 * faster.
 */
export function SuggestField({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  autoComplete,
  invalid = false,
  describedBy,
  inputRef,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** What to offer for the current value; empty when nothing fits. */
  suggestions: { key: string; label: string; hint?: string }[];
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  describedBy?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // A click anywhere else closes the list.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const shown = open && suggestions.length > 0;

  function pick(index: number) {
    const item = suggestions[index];
    if (!item) return;
    onChange(item.label);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete ?? "off"}
        role="combobox"
        aria-expanded={shown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!shown) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((current) => (current + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            pick(active);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`field ${invalid ? "border-danger focus:border-danger" : ""}`}
      />
      {shown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-control border border-line bg-surface py-1 shadow-pop"
        >
          {suggestions.map((item, index) => (
            <li
              key={item.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                // Before the input's blur, so the click lands on the item.
                event.preventDefault();
                pick(index);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2 text-sm ${
                index === active ? "bg-brand-50 text-brand-700" : "text-ink-800"
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.hint && <span className="shrink-0 text-xs text-ink-400">{item.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
