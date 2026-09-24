"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { updatePaymentPrefs } from "@/app/actions/account";
import { PaymentMark } from "@/components/checkout/PaymentMark";
import { Busy, Swap } from "@/components/ui/Swap";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CheckIcon } from "@/components/ui/icons";
import { shakeField } from "@/components/ui/field-fault";

export type PaymentPrefs = {
  /** "tbc", "bog", or empty. */
  refundBank: string;
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
export function PaymentPrefsForm({ prefs }: { prefs: PaymentPrefs }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "invalid" | "failed">(
    "idle",
  );
  const [bank, setBank] = useState(prefs.refundBank);
  /* The box reddens on a bad IBAN and says nothing else — see the
     `aria-invalid` below. Cleared as soon as it is typed in again. */
  const [ibanBad, setIbanBad] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("idle");
    startTransition(async () => {
      const result = await updatePaymentPrefs(formData);
      if (!result.ok) {
        setStatus(result.error === "invalid" ? "invalid" : "failed");
        if (result.error === "invalid") {
          setIbanBad(true);
          shakeField(document.getElementById("refundIban"));
        }
        return;
      }
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2400);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col">
      {/* -------------------------- refund account ------------------------ */}
      <section className="pb-7">
        <h2 className="text-base font-bold text-ink-900">
          {t.account.refundAccount}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {t.account.refundAccountHint}
        </p>

        {/* Which bank the account is at: the two the shop deals with, as
            two cards with the bank's mark — chosen again clears it, since
            an account at neither is a perfectly good answer. */}
        <div className="bank-picks mt-4">
          {(["tbc", "bog"] as const).map((id) => (
            <label key={id} className={`bank-pick ${bank === id ? "is-on" : ""}`}>
              <input
                type="radio"
                name="refundBank"
                value={id}
                checked={bank === id}
                onChange={() => setBank(id)}
                onClick={() => bank === id && setBank("")}
                className="sr-only"
              />
              <PaymentMark method={id} />
              <span className="bank-pick-name">{t.payment[id]}</span>
              <span className="bank-pick-tick" aria-hidden="true">
                <CheckIcon size={13} strokeWidth={3} />
              </span>
            </label>
          ))}
        </div>

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
              aria-invalid={ibanBad || undefined}
              onChange={() => ibanBad && setIbanBad(false)}
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
      <section className="border-t border-line py-7">
        <h2 className="text-base font-bold text-ink-900">
          {t.account.invoiceDetails}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
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
        {/* Nothing is said in words: a bad account number reddens its own
            box, and a save that worked puts a tick in the button for a
            moment. */}
        <span className="sr-only" role="status">
          {status === "saved" ? t.account.paymentsSaved : status === "invalid" ? t.account.refundIbanInvalid : ""}
        </span>
        <button type="submit" disabled={isPending} className="btn btn-primary btn-md w-full sm:ml-auto sm:w-auto">
          <Swap
            show={
              isPending ? (
                <Busy label={t.account.saving} />
              ) : status === "saved" ? (
                <>
                  <CheckIcon size={16} strokeWidth={3} />
                  {t.account.saveProfile}
                </>
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
