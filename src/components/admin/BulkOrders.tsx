"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CloseIcon, SpinnerIcon } from "@/components/ui/icons";
import { bulkOrders } from "@/app/actions/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { fill } from "@/lib/i18n";

/**
 * Moving several orders at once.
 *
 * The same shape as the products table's bar, and deliberately so: a shop
 * owner who has learned to tick rows and act on the selection in one table
 * should not find a different idea in the next one.
 *
 * A button per status rather than a dropdown and an Apply. Twelve orders in
 * four different states, moved by a control that says "shipped", all end up
 * shipped — which is the point, and is exactly what a reader cannot be sure of
 * when the control is a select showing one of the twelve's current values.
 *
 * `pending` is not offered. Every other status is somewhere an order can be
 * put; "back to pending" is somewhere it has already been, and undoing a
 * dispatch for a dozen orders at once is not a thing to make easy from a
 * toolbar. One order at a time, on its own page, still can.
 */

const BULK_STATUSES = ORDER_STATUSES.filter((status) => status !== "pending");

export function BulkOrders({
  ids,
  children,
}: {
  /** Every order id on the page, in the order they are drawn. */
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

  /* A viewer reads this table and changes nothing in it, so there is nothing
     to select. The gate is on the server too — this only withdraws the offer. */
  if (!canWrite) return <>{children}</>;

  const all = ids.length > 0 && ids.every((id) => selected.has(id));

  /**
   * Puts the checkboxes back in step with the selection.
   *
   * The rows are server-rendered and their checkboxes uncontrolled, so
   * clearing the selection in state would leave twenty boxes visibly ticked.
   */
  function syncBoxes(on: boolean) {
    for (const input of box.current?.querySelectorAll<HTMLInputElement>(
      'input[name="order-id"]',
    ) ?? []) {
      input.checked = on;
    }
  }

  function run(status: OrderStatus) {
    const chosen = [...selected];

    if (status === "cancelled") {
      // The one that gives stock back and marks money refunded. `confirm` is
      // the browser's: it cannot be styled into looking like a hint, and it
      // works before hydration has finished.
      const sure = window.confirm(fill(t.admin.bulkConfirmCancel, { count: chosen.length }));
      if (!sure) return;
    }

    setFailed(false);
    setDone(null);

    startTransition(async () => {
      const result = await bulkOrders(status, chosen);

      if (!result.ok) {
        setFailed(true);
        return;
      }

      setSelected(new Set());
      syncBoxes(false);
      // Zero is a real answer — every order picked was already in that status —
      // and it has its own sentence below rather than "done, 0 orders".
      setDone(result.count ?? 0);
      router.refresh();
    });
  }

  return (
    <div
      ref={box}
      /* One listener for the whole table rather than a prop threaded into every
         row: the checkboxes are server-rendered and their changes bubble. */
      onChange={(event) => {
        const target = event.target as HTMLInputElement;
        if (target.name !== "order-id") return;
        setDone(null);
        setSelected((current) => {
          const next = new Set(current);
          if (target.checked) next.add(target.value);
          else next.delete(target.value);
          return next;
        });
      }}
    >
      {/* Takes no room until it has something to say. A permanently visible
          row of disabled buttons is noise on every visit for a feature used
          occasionally. */}
      {selected.size > 0 && (
        <div className="card card-pad-tight sticky top-[calc(var(--header-h)+0.5rem)] z-20 mt-3 flex flex-wrap items-center gap-2">
          <p aria-live="polite" className="mr-auto text-sm font-bold text-ink-900">
            {fill(t.admin.bulkSelected, { count: selected.size })}
          </p>

          <span className="text-xs text-ink-500">{t.admin.bulkMarkAs}</span>

          {BULK_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => run(status)}
              disabled={isPending}
              className={`btn btn-outline btn-sm ${
                status === "cancelled" ? "text-danger hover:bg-danger-soft" : ""
              }`}
            >
              {isPending && <SpinnerIcon size={14} />}
              {t.status[status]}
            </button>
          ))}

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

      {/* `status` rather than `alert`: it confirms something the reader asked
          for and must not interrupt them. */}
      {done !== null && (
        <p
          role="status"
          className={`mt-3 text-sm font-semibold ${done > 0 ? "text-success" : "text-ink-500"}`}
        >
          {done > 0 ? fill(t.admin.bulkOrdersDone, { count: done }) : t.admin.bulkOrdersNone}
        </p>
      )}

      {/* Select-all beside the table rather than in the header row: the mobile
          layout has no header row, and a control that exists at one width and
          not another is one people stop trusting. */}
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
