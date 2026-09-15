"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { saveMarketingSpend } from "@/app/actions/analytics";
import { Busy, Swap } from "@/components/ui/Swap";
import { CheckIcon } from "@/components/ui/icons";

/**
 * The one figure on the analytics page the shop types in: what it spent
 * bringing people to it, per month. One row per month the window touches,
 * a field in lari and a save for each — the figure divides into "cost per
 * customer" and comes off the net profit the moment it is saved.
 */
export function MarketingSpend({ months }: { months: { month: string; amount: number }[] }) {
  const { t } = useI18n();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ month: string; state: "saved" | "invalid" | "failed" } | null>(null);

  // From the dictionary rather than `Intl`: a browser without Georgian
  // locale data prints "June" on a page that is otherwise in Georgian.
  const monthName = (month: string) => {
    const [year, index] = month.split("-");
    return `${t.common.months[Number(index) - 1]} ${year}`;
  };

  function save(month: string, form: HTMLFormElement) {
    const amount = String(new FormData(form).get("amount") ?? "");
    setStatus(null);
    startTransition(async () => {
      const result = await saveMarketingSpend(month, amount);
      setStatus({
        month,
        state: result.ok ? "saved" : result.error === "invalid" ? "invalid" : "failed",
      });
    });
  }

  return (
    <ul className="flex flex-col divide-y divide-line">
      {months.map(({ month, amount }) => (
        <li key={month}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save(month, event.currentTarget);
            }}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5"
          >
            <label htmlFor={`spend-${month}`} className="min-w-36 flex-1 text-sm font-semibold text-ink-800">
              {monthName(month)}
            </label>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  id={`spend-${month}`}
                  name="amount"
                  inputMode="decimal"
                  defaultValue={(amount / 100).toFixed(2)}
                  disabled={!canWrite}
                  aria-invalid={status?.month === month && status.state === "invalid"}
                  className="field h-10 w-36 pr-8 text-right font-mono tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-ink-400">
                  ₾
                </span>
              </div>
              {canWrite && (
                <button type="submit" disabled={isPending} className="btn btn-outline btn-sm">
                  <Swap
                    show={isPending ? <Busy label={t.admin.save} /> : t.admin.save}
                    of={[t.admin.save]}
                  />
                </button>
              )}
              {status?.month === month && (
                <span
                  role="status"
                  className={`flex items-center gap-1 text-xs font-semibold ${
                    status.state === "saved" ? "text-success" : "text-danger"
                  }`}
                >
                  {status.state === "saved" && <CheckIcon size={14} />}
                  {status.state === "saved"
                    ? t.admin.anSpendSaved
                    : status.state === "invalid"
                      ? t.admin.anSpendInvalid
                      : t.common.error}
                </span>
              )}
            </div>
          </form>
        </li>
      ))}
    </ul>
  );
}
