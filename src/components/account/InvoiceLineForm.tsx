"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { updatePaymentPrefs } from "@/app/actions/account";
import { Busy, Swap } from "@/components/ui/Swap";
import { ErrorNote } from "@/components/ui/ErrorNote";

export type InvoicePrefs = { invoiceCompany: string; invoiceTaxId: string };

/**
 * The company line an invoice should carry. Its own small form, saved on
 * its own button — the accounts above it are saved one at a time, and a
 * single "save everything" bar over two unrelated things was a button
 * whose meaning depended on where you had been typing.
 */
export function InvoiceLineForm({ prefs }: { prefs: InvoicePrefs }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("idle");
    startTransition(async () => {
      const result = await updatePaymentPrefs(formData);
      if (!result.ok) {
        setStatus("failed");
        return;
      }
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2400);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit}>
      <h2 className="text-base font-bold text-ink-900">{t.account.invoiceDetails}</h2>
      <p className="mt-1 text-sm text-ink-500">{t.account.invoiceDetailsHint}</p>

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

      {/* Nothing is drawn when it saves; a screen reader still gets told. */}
      <span className="sr-only" role="status">
        {status === "saved" ? t.account.paymentsSaved : ""}
      </span>

      {/* The button says one thing and keeps saying it: a tick that
          appeared inside it read as a second control. */}
      <button type="submit" disabled={isPending} className="btn btn-primary btn-md mt-4 w-full sm:w-auto">
        <Swap
          show={isPending ? <Busy label={t.account.saving} /> : t.account.saveProfile}
          of={[t.account.saveProfile, t.account.saving]}
        />
      </button>

      {status === "failed" && (
        <ErrorNote className="mt-3" title={t.account.paymentsFailed} hint={t.common.errorHint} />
      )}
    </form>
  );
}
