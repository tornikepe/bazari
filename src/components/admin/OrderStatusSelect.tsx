"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { updateOrderStatus } from "@/app/actions/admin";
import { SpinnerIcon } from "@/components/ui/icons";
import { ORDER_STATUSES } from "@/lib/order-status";

export function OrderStatusSelect({ id, status }: { id: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  // The whole control is the mutation. The row already shows the status as a
  // badge, so a viewer loses nothing by not being handed the dropdown.
  if (!canWrite) return null;

  return (
    <span className="inline-flex items-center gap-2">
      {isPending && <SpinnerIcon size={14} className="text-ink-400" />}

      <select
        value={status}
        disabled={isPending}
        aria-label={t.admin.updateStatus}
        onChange={(event) => {
          const next = event.target.value;
          startTransition(async () => {
            await updateOrderStatus(id, next);
            router.refresh();
          });
        }}
        className="field h-9 w-full min-w-0 text-xs sm:w-40"
      >
        {ORDER_STATUSES.map((value) => (
          <option key={value} value={value}>
            {t.status[value]}
          </option>
        ))}
      </select>
    </span>
  );
}
