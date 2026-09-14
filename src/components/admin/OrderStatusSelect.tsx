"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { updateOrderStatus } from "@/app/actions/admin";
import { SpinnerIcon } from "@/components/ui/icons";
import { ORDER_STATUSES } from "@/lib/order-status";

/**
 * The status, as a control.
 *
 * One dropdown per order, on the list and on the detail page. Two things it
 * did not do: ask before cancelling — the bulk bar asks, and a slip of the
 * wheel on one row cancelled an order, refunded it and put its stock back
 * without a word — and say when the change was refused, which left the
 * dropdown showing a status the order did not have until the next refresh.
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

  // The whole control is the mutation. The row already shows the status as a
  // badge, so a viewer loses nothing by not being handed the dropdown.
  if (!canWrite) return null;

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        {isPending && <SpinnerIcon size={14} className="text-ink-400" />}

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
          className="field h-9 w-full min-w-0 text-xs sm:w-40"
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
