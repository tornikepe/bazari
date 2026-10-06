"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { updateOrderStatus } from "@/app/actions/admin";
import { SpinnerIcon } from "@/components/ui/icons";
import { ORDER_STATUSES } from "@/lib/order-status";
import { StatusBadge, STATUS_DOTS } from "@/components/ui/StatusBadge";

/**
 * The status, as a control.
 *
 * One dropdown per order, on the list and on the detail page. Two things it
 * did not do: ask before cancelling — the bulk bar asks, and a slip of the
 * wheel on one row cancelled an order, refunded it and put its stock back
 * without a word — and say when the change was refused, which left the
 * dropdown showing a status the order did not have until the next refresh.
 *
 * It owns the status outright now: the badge used to sit beside it saying
 * the same word, so every order card and every table row printed
 * "confirmed" twice in two controls an inch apart. The dropdown already
 * says what the status is; what it was missing was the colour that made the
 * badge worth scanning, so it carries a dot in the status's own colour. A
 * viewer, who gets no dropdown, gets the badge — which is what the badge
 * was always for.
 */
export function OrderStatusSelect({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  // The control's own value, so a refused or declined change can be put back
  // at once instead of waiting for the server to redraw the row.
  const [value, setValue] = useState(status);
  const [failed, setFailed] = useState(false);

  // The whole control is the mutation, so somebody who may not mutate gets
  // the plain badge instead — still the status, just not a way to change it.
  if (!canWrite) return <StatusBadge status={status} t={t} />;

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        {isPending ? (
          <SpinnerIcon size={14} className="text-ink-400" />
        ) : (
          /* The badge's colour, kept as a dot: a list of orders is scanned
             by colour before it is read, and that is what was lost when the
             badge beside this control went. */
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-pill ${STATUS_DOTS[value] ?? "bg-ink-300"}`}
          />
        )}

        <select
          value={value}
          disabled={isPending}
          aria-label={t.admin.updateStatus}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "cancelled" && !window.confirm(t.admin.cancelOrderConfirm)) return;

            setFailed(false);
            setValue(next);
            startTransition(async () => {
              const result = await updateOrderStatus(id, next);
              if (!result.ok) {
                setValue(status);
                setFailed(true);
                return;
              }
              router.refresh();
            });
          }}
          className="field h-9 w-full min-w-0 text-xs sm:w-44"
        >
          {ORDER_STATUSES.map((option) => (
            <option key={option} value={option}>
              {t.status[option]}
            </option>
          ))}
        </select>
      </span>

      {failed && (
        <span role="alert" className="text-xs text-danger">
          {t.admin.statusFailed}
        </span>
      )}
    </span>
  );
}
