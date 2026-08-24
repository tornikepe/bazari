"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CheckIcon, CloseIcon, SpinnerIcon } from "@/components/ui/icons";
import { bulkCustomers } from "@/app/actions/customers";
import { fill } from "@/lib/i18n";

/**
 * Switching several customer accounts off, or back on.
 *
 * The third table to get this bar, and the third to get the same one: tick the
 * rows, act on the selection, and the bar takes no room until there is a
 * selection to act on.
 *
 * Turning accounts off asks first. It is not destructive — the rows stay, the
 * orders stay, and turning them back on is one click — but it does end whatever
 * sessions those people have open, and doing that to twenty strangers by
 * mis-clicking is worth one sentence of friction.
 *
 * Staff cannot be reached from here even if a crafted post carried their ids:
 * the server filters on `role = customer`, and a staff account is managed on
 * the staff page, which knows about the last-admin rule.
 */
export function BulkCustomers({
  ids,
  children,
}: {
  /** Every customer id on the page, in the order they are drawn. */
  ids: string[];
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  const box = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  /* A viewer reads this table and changes nothing in it. The server refuses as
     well; this only withdraws the offer. */
  if (!canWrite) return <>{children}</>;

  const all = ids.length > 0 && ids.every((id) => selected.has(id));

  /** The rows are server-rendered, so their checkboxes are uncontrolled. */
  function syncBoxes(on: boolean) {
    for (const input of box.current?.querySelectorAll<HTMLInputElement>(
      'input[name="customer-id"]',
    ) ?? []) {
      input.checked = on;
    }
  }

  function run(disabled: boolean) {
    const chosen = [...selected];

    if (disabled) {
      const sure = window.confirm(fill(t.admin.customerConfirmDisable, { count: chosen.length }));
      if (!sure) return;
    }

    setFailed(false);
    setDone(null);

    startTransition(async () => {
      const result = await bulkCustomers(disabled, chosen);

      if (!result.ok) {
        setFailed(true);
        return;
      }

      setSelected(new Set());
      syncBoxes(false);
      setDone(result.count ?? 0);
      router.refresh();
    });
  }

  return (
    <div
      ref={box}
      onChange={(event) => {
        const target = event.target as HTMLInputElement;
        if (target.name !== "customer-id") return;
        setDone(null);
        setSelected((current) => {
          const next = new Set(current);
          if (target.checked) next.add(target.value);
          else next.delete(target.value);
          return next;
        });
      }}
    >
      {selected.size > 0 && (
        <div className="card card-pad-tight sticky top-[calc(var(--header-h)+0.5rem)] z-20 mt-3 flex flex-wrap items-center gap-2">
          <p aria-live="polite" className="mr-auto text-sm font-bold text-ink-900">
            {fill(t.admin.bulkSelected, { count: selected.size })}
          </p>

          <button
            type="button"
            onClick={() => run(false)}
            disabled={isPending}
            className="btn btn-outline btn-sm"
          >
            {isPending ? <SpinnerIcon size={14} /> : <CheckIcon size={14} />}
            {t.admin.staffEnable}
          </button>

          <button
            type="button"
            onClick={() => run(true)}
            disabled={isPending}
            className="btn btn-outline btn-sm text-danger hover:bg-danger-soft"
          >
            {t.admin.staffDisable}
          </button>

          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              syncBoxes(false);
            }}
            aria-label={t.admin.bulkClear}
            className="btn btn-ghost h-9 w-9 rounded-control p-0"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {failed && <ErrorNote className="mt-3" title={t.common.error} hint={t.common.errorHint} />}

      {done !== null && (
        <p
          role="status"
          className={`mt-3 text-sm font-semibold ${done > 0 ? "text-success" : "text-ink-500"}`}
        >
          {done > 0 ? fill(t.admin.bulkCustomersDone, { count: done }) : t.admin.bulkCustomersNone}
        </p>
      )}

      <label className="mt-3 flex w-fit items-center gap-2 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={all}
          onChange={(event) => {
            setDone(null);
            setSelected(event.target.checked ? new Set(ids) : new Set());
            syncBoxes(event.target.checked);
          }}
          className="h-4 w-4 accent-brand-600"
        />
        {t.admin.bulkSelectAll}
      </label>

      {children}
    </div>
  );
}
