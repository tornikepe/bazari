"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { updatePaymentPrefs } from "@/app/actions/account";
import { PaymentMark } from "@/components/checkout/PaymentMark";
import { Busy, Swap } from "@/components/ui/Swap";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CheckIcon } from "@/components/ui/icons";
import type { PaymentMethod } from "@/lib/payment";

export type PaymentPrefs = {
  preferredPayment: PaymentMethod | null;
  refundIban: string;
  refundName: string;
  invoiceCompany: string;
  invoiceTaxId: string;
};

/**
 * The customer's payment page.
 *
 * Nothing here is a card: card details are entered on the bank's page at
 * the moment of paying and are never held by this shop, which the page says
 * in as many words. What a customer *can* settle in advance is which of the
 * shop's methods the checkout should have ready for them, where money should
 * go if an order paid in cash or by transfer comes back, and the company
 * line an invoice should carry.
 */
export function PaymentPrefsForm({
  prefs,
  methods,
}: {
  prefs: PaymentPrefs;
  /** The methods the checkout offers today, in its order. */
  methods: PaymentMethod[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "invalid" | "failed">(
    "idle",
  );
  // One of the methods is always chosen — the first, until a choice is
  // saved: a default that can be "none" is not a default.
  const [choice, setChoice] = useState<string>(prefs.preferredPayment ?? methods[0] ?? "");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("idle");
    startTransition(async () => {
      const result = await updatePaymentPrefs(formData);
      if (!result.ok) {
        setStatus(result.error === "invalid" ? "invalid" : "failed");
        return;
      }
      setStatus("saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="stagger flex flex-col gap-4">
      {/* ------------------------- default method ------------------------- */}
      <section className="card card-pad">
        <h2 className="text-sm font-bold text-ink-900">
          {t.account.preferredPayment}
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          {t.account.preferredPaymentHint}
        </p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {methods.map((method) => (
            <label
              key={method}
              className={`flex cursor-pointer items-center gap-3 rounded-control border px-3.5 py-3 text-sm transition-colors ${
                choice === method
                  ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                  : "border-line text-ink-700 hover:border-ink-300"
              }`}
            >
              <input
                type="radio"
                name="preferredPayment"
                value={method}
                checked={choice === method}
                onChange={() => setChoice(method)}
                className="h-4 w-4 shrink-0 accent-[var(--color-brand-600)]"
              />
              <PaymentMark method={method} />
              <span className="min-w-0 leading-snug">
                {t.payment[method]}
                <span className="block text-xs font-normal text-ink-500">
                  {t.account.methodHint[method]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* -------------------------- refund account ------------------------ */}
      <section className="card card-pad">
        <h2 className="text-sm font-bold text-ink-900">
          {t.account.refundAccount}
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          {t.account.refundAccountHint}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="refundIban" className="field-label">
              {t.account.refundIban}
            </label>
            <input
              id="refundIban"
              name="refundIban"
              defaultValue={prefs.refundIban}
              placeholder="GE00XX0000000000000000"
              autoComplete="off"
              spellCheck={false}
              className="field font-mono"
            />
          </div>
          <div>
            <label htmlFor="refundName" className="field-label">
              {t.account.refundName}
            </label>
            <input
              id="refundName"
              name="refundName"
              defaultValue={prefs.refundName}
              autoComplete="name"
              className="field"
            />
          </div>
        </div>
      </section>

      {/* --------------------------- invoice line ------------------------- */}
      <section className="card card-pad">
        <h2 className="text-sm font-bold text-ink-900">
          {t.account.invoiceDetails}
        </h2>
        <p className="mt-1 text-xs text-ink-500">
          {t.account.invoiceDetailsHint}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="invoiceCompany" className="field-label">
              {t.account.invoiceCompany}
            </label>
            <input
              id="invoiceCompany"
              name="invoiceCompany"
              defaultValue={prefs.invoiceCompany}
              autoComplete="organization"
              className="field"
            />
          </div>
          <div>
            <label htmlFor="invoiceTaxId" className="field-label">
              {t.account.invoiceTaxId}
            </label>
            <input
              id="invoiceTaxId"
              name="invoiceTaxId"
              defaultValue={prefs.invoiceTaxId}
              autoComplete="off"
              className="field font-mono"
            />
          </div>
        </div>
      </section>

      {/* The save bar: sticks to the foot of the screen while the form is
          longer than it, so the button is at hand wherever the change was
          made — the status beside it, the button at the right. */}
      <div className="form-bar">
        <div className="min-w-0 flex-1 text-sm">
          {status === "saved" ? (
            <span role="status" className="flex items-center gap-1.5 font-semibold text-success">
              <CheckIcon size={16} />
              {t.account.paymentsSaved}
            </span>
          ) : status === "invalid" ? (
            <span role="alert" className="font-semibold text-danger">
              {t.account.refundIbanInvalid}
            </span>
          ) : (
            <span className="text-ink-500">{t.account.preferredPaymentHint}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="btn btn-primary btn-md shrink-0"
        >
          <Swap
            show={
              isPending ? (
                <Busy label={t.account.saving} />
              ) : (
                t.account.saveProfile
              )
            }
            of={[t.account.saveProfile]}
          />
        </button>
      </div>
      {status === "failed" && (
        <ErrorNote title={t.account.paymentsFailed} hint={t.common.errorHint} />
      )}
    </form>
  );
}
