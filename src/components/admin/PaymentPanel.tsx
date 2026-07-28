"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { markPaymentReceived, refundPayment } from "@/app/actions/payments";
import { formatDateTime, formatPrice } from "@/lib/format";
import { SpinnerIcon } from "@/components/ui/icons";
import type { PaymentState } from "@/lib/payments/types";

export type PaymentRow = {
  id: string;
  provider: string;
  state: PaymentState;
  /** Tetri. */
  amount: number;
  refunded: number;
  createdAt: Date;
  capturedAt: Date | null;
  failReason: string;
};

/** Colour follows meaning: captured is good, failed/expired are not. */
const TONE: Record<PaymentState, string> = {
  captured: "bg-success-soft text-success",
  authorized: "bg-info-soft text-info",
  pending: "bg-warning-soft text-warning",
  refunded: "bg-ink-100 text-ink-600",
  failed: "bg-danger-soft text-danger",
  cancelled: "bg-ink-100 text-ink-600",
  expired: "bg-ink-100 text-ink-600",
};

export function PaymentPanel({ payments }: { payments: PaymentRow[] }) {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "failed");
    });
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold text-ink-900">{t.admin.paymentAttempts}</h2>

      {payments.length === 0 ? (
        <p className="mt-3 text-xs text-ink-500">{t.admin.noPayments}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {payments.map((payment) => (
            <li key={payment.id} className="rounded-control border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-pill px-2 py-0.5 text-xs font-bold ${TONE[payment.state]}`}
                >
                  {t.paymentState[payment.state]}
                </span>
                <span className="text-sm font-bold text-ink-900">
                  {formatPrice(payment.amount / 100, locale)}
                </span>
              </div>

              <p className="mt-1.5 text-xs text-ink-400">
                {payment.provider} · {formatDateTime(payment.createdAt)}
              </p>

              {payment.failReason && (
                <p className="mt-1 text-xs text-danger">{payment.failReason}</p>
              )}

              <div className="mt-2.5 flex flex-wrap gap-2">
                {/* Cash is collected by a human, so a human confirms it. */}
                {payment.provider === "manual" && payment.state !== "captured" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => markPaymentReceived(payment.id))}
                    className="btn btn-primary btn-sm"
                  >
                    {pending && <SpinnerIcon size={14} />}
                    {t.admin.markPaid}
                  </button>
                )}

                {payment.state === "captured" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(t.admin.refundConfirm)) run(() => refundPayment(payment.id));
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    {pending && <SpinnerIcon size={14} />}
                    {t.admin.refund}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
