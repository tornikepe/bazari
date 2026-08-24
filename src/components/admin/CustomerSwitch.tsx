"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { SpinnerIcon } from "@/components/ui/icons";
import { setCustomerDisabled } from "@/app/actions/customers";
import { fill } from "@/lib/i18n";

/**
 * One customer's account, on or off.
 *
 * The state is shown as a word rather than as a toggle. A switch has to be
 * read twice — once for its position and once for what the position means —
 * and for something that decides whether a person can sign in, "Off" beside a
 * button that says "Turn on the account" leaves nothing to work out.
 *
 * Turning it off asks first: nothing is lost, the orders stay and it is one
 * click back, but it does end whatever session that person has open.
 */
export function CustomerSwitch({ id, disabled }: { id: string; disabled: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  if (!canWrite) {
    // A viewer still needs to know which it is; they just cannot change it.
    return disabled ? <span className="badge bg-danger-soft text-danger">{t.admin.customerDisabled}</span> : null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {disabled && <span className="badge bg-danger-soft text-danger">{t.admin.customerDisabled}</span>}

      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!disabled) {
            const sure = window.confirm(fill(t.admin.customerConfirmDisable, { count: 1 }));
            if (!sure) return;
          }

          setFailed(false);
          startTransition(async () => {
            const result = await setCustomerDisabled(id, !disabled);
            if (!result.ok) {
              setFailed(true);
              return;
            }
            router.refresh();
          });
        }}
        className={`btn btn-outline btn-sm ${disabled ? "" : "text-danger hover:bg-danger-soft"}`}
      >
        {isPending && <SpinnerIcon size={14} />}
        {disabled ? t.admin.customerEnable : t.admin.customerDisable}
      </button>

      {failed && (
        <span role="alert" className="text-xs font-semibold text-danger">
          {t.common.error}
        </span>
      )}
    </div>
  );
}
