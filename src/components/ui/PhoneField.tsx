"use client";

import { useState } from "react";
import { PHONE_PREFIX, formatDigits, localDigits } from "@/lib/phone";

/**
 * A Georgian mobile number: `+995` fixed at the front, nine digits typed
 * after it and spaced as they go — `555 55 55 55` — so the number reads as
 * a number while it is being typed. What the form receives (in `name`) is
 * the full `+995 5XX XX XX XX`; what the person sees and edits is only
 * their part.
 *
 * Controlled from the outside when the form keeps its own state (the
 * checkout), or by itself otherwise (sign-up, the profile).
 */
export function PhoneField({
  id = "phone",
  name = "phone",
  value,
  defaultValue = "",
  onChange,
  required = false,
  invalid = false,
  describedBy,
  autoComplete = "tel-national",
  className = "",
}: {
  id?: string;
  name?: string;
  /** The full number, when the form owns it. */
  value?: string;
  defaultValue?: string;
  /** Called with the full `+995 …` number, or "" when nothing is typed. */
  onChange?: (full: string) => void;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  autoComplete?: string;
  className?: string;
}) {
  const [own, setOwn] = useState(() => formatDigits(localDigits(defaultValue) ?? ""));
  const shown = value === undefined ? own : formatDigits(localDigits(value) ?? value.replace(/\D/g, ""));
  const digits = shown.replace(/\D/g, "");
  const full = digits ? `${PHONE_PREFIX} ${shown}` : "";

  function type(next: string) {
    const formatted = formatDigits(next);
    if (value === undefined) setOwn(formatted);
    const d = formatted.replace(/\D/g, "");
    onChange?.(d ? `${PHONE_PREFIX} ${formatted}` : "");
  }

  return (
    <div
      className={`field flex items-center gap-2 px-0 focus-within:border-ink-900 focus-within:shadow-[0_0_0_3px_var(--color-ink-100)] ${
        invalid ? "border-danger" : ""
      } ${className}`}
    >
      <span className="border-r border-line px-3.5 text-sm font-semibold text-ink-500 select-none">
        {PHONE_PREFIX}
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={shown}
        onChange={(event) => type(event.target.value)}
        placeholder="5XX XX XX XX"
        maxLength={12}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete={autoComplete}
        className="h-full min-w-0 flex-1 bg-transparent pr-3.5 text-sm text-ink-900 outline-none tabular-nums placeholder:text-ink-400"
      />
      {/* The whole number, for the form. */}
      <input type="hidden" name={name} value={full} />
    </div>
  );
}
