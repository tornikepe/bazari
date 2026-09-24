"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { retryPayment } from "@/app/actions/payments-gateway";

/** "Pay now", on an unpaid card order: opens a new attempt and goes there. */
export function PayNowButton({ orderNumber }: { orderNumber: string }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setFailed(false);
          startTransition(async () => {
            const result = await retryPayment(orderNumber);
            if (result.ok) {
              window.location.assign(result.redirect);
              return;
            }
            setFailed(true);
          });
        }}
        className="btn btn-primary btn-md"
      >
        {t.orderDone.payNow}
      </button>
      {failed && <ErrorNote title={t.orderDone.payNowFailed} hint={t.orderDone.payNowFailedHint} />}
    </div>
  );
}
