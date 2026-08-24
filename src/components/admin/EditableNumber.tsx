"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { setProductNumber } from "@/app/actions/admin";
import { fill } from "@/lib/i18n";

/**
 * A price or a stock figure, changed where it is read.
 *
 * Reprice a product and the form asks for a page load, a scroll, a field, a
 * save and a bounce back to the table — five steps for one number, done
 * several times a day. This is the number, and typing over it changes it.
 *
 * It is a button until it is pressed, not an input that merely looks like
 * text. A grid of inputs reads as a form and invites a reader to tab through
 * it filling things in; a grid of numbers with one of them open for editing
 * reads as what it is. The button also gives the control an accessible name
 * that says which product it belongs to, which a bare input in the fourth
 * column of the eleventh row cannot.
 *
 * Enter or leaving the field saves; Escape puts the old value back. There is
 * no Save button, because a control whose only job is to confirm one number is
 * a second click for something the keyboard already ends.
 */
export function EditableNumber({
  id,
  field,
  value,
  display,
  name,
}: {
  id: string;
  field: "price" | "stock";
  /** In whatever unit the field is typed in: lari for a price, units for stock. */
  value: number;
  /** What it looks like when nobody is editing — a formatted price, or a badge. */
  display: React.ReactNode;
  /** The product's name, for the control's accessible name. */
  name: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  // Read-only staff see the figure and nothing else. The server refuses too.
  if (!canWrite) return <>{display}</>;

  function save() {
    const next = Number(draft);
    setEditing(false);

    // Nothing typed, or the same number typed again: no round trip, and no
    // "Saved" for a save that did not happen.
    if (!Number.isFinite(next) || next === value) {
      setDraft(String(value));
      return;
    }

    setFailed(false);
    startTransition(async () => {
      const result = await setProductNumber(id, field, next);

      if (!result.ok) {
        setFailed(true);
        setDraft(String(value));
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        ref={input}
        type="number"
        inputMode="decimal"
        min={0}
        step={field === "price" ? "0.01" : "1"}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(String(value));
            setEditing(false);
          }
        }}
        aria-label={fill(field === "price" ? t.admin.editPrice : t.admin.editStock, { name })}
        className="field h-8 w-24 px-2 text-right text-sm tabular-nums"
      />
    );
  }

  return (
    /* The confirmation is a sibling of the button, not a child of it. Inside,
       it becomes part of the control's own text — which reads as "₾7.77 Saved"
       to a screen reader announcing the button, and to anything else that asks
       the button what it says. */
    <span className="inline-flex items-baseline gap-1.5">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setSaved(false);
          setDraft(String(value));
          setEditing(true);
        }}
        aria-label={fill(field === "price" ? t.admin.editPrice : t.admin.editStock, { name })}
        /* A dotted underline rather than a border: eleven bordered boxes down a
           column is a form, and this is a table. */
        className={`decoration-dotted underline-offset-4 hover:underline ${
          failed ? "text-danger" : ""
        } ${isPending ? "opacity-60" : ""}`}
      >
        {display}
      </button>

      {saved && !isPending && (
        <span role="status" className="text-xs font-semibold text-success">
          {t.admin.editSaved}
        </span>
      )}
    </span>
  );
}
