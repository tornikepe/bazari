"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { PaymentMark } from "@/components/checkout/PaymentMark";
import { CheckIcon, PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from "@/components/ui/icons";
import { shakeField } from "@/components/ui/field-fault";
import {
  deleteRefundAccount,
  makeDefaultRefundAccount,
  saveRefundAccount,
} from "@/app/actions/refund-accounts";
import { MAX_REFUND_ACCOUNTS } from "@/lib/refund-accounts";

export type SavedRefundAccount = {
  id: string;
  bank: string;
  iban: string;
  holder: string;
  isDefault: boolean;
};

/**
 * The accounts a refund can be sent to, kept the way the addresses are:
 * tiles with the bank's mark, and one form that both adds and edits.
 *
 * Two is the most — a personal account and a company one — and the shop
 * says so where the button would be rather than refusing a third after it
 * has been typed.
 */
export function RefundAccounts({ accounts }: { accounts: SavedRefundAccount[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /** `null` when closed, `"new"` when adding, otherwise the id being edited. */
  const [editing, setEditing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ibanBad, setIbanBad] = useState(false);
  const [holderBad, setHolderBad] = useState(false);
  const [bank, setBank] = useState("");

  const current = accounts.find((account) => account.id === editing);
  const full = accounts.length >= MAX_REFUND_ACCOUNTS;

  function open(id: string | null) {
    setFailed(false);
    setIbanBad(false);
    setHolderBad(false);
    setBank(id ? (accounts.find((account) => account.id === id)?.bank ?? "") : "");
    setEditing(id);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFailed(false);
    setIbanBad(false);
    setHolderBad(false);

    /* Both are required, and the form says which is missing before it asks
       the server — an empty name and a bad number are different mistakes. */
    const iban = String(formData.get("iban") ?? "").trim();
    const holder = String(formData.get("holder") ?? "").trim();
    if (!iban || !holder) {
      if (!iban) {
        setIbanBad(true);
        shakeField(document.getElementById("account-iban"));
      }
      if (!holder) {
        setHolderBad(true);
        if (iban) shakeField(document.getElementById("account-holder"));
      }
      return;
    }

    startTransition(async () => {
      const result = await saveRefundAccount(formData);
      if (!result.ok) {
        /* A number in the wrong shape reddens its own box; anything else
           is the shop's own failure and says so. */
        if (result.error === "invalid") {
          setIbanBad(true);
          shakeField(document.getElementById("account-iban"));
        } else {
          setFailed(true);
        }
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function act(run: () => Promise<{ ok: boolean }>) {
    setFailed(false);
    startTransition(async () => {
      const result = await run();
      if (!result.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section>
      <p className="text-sm text-ink-500">{t.account.refundAccountHint}</p>

      {failed && <ErrorNote className="mt-3" title={t.common.error} hint={t.common.errorHint} />}

      {/* Nothing saved yet: the invitation in the middle, as the address
          book's is. */}
      {accounts.length === 0 && !editing && (
        <div className="mt-6 flex flex-col items-center rounded-card border border-dashed border-ink-300 px-4 py-8 text-center">
          <span className="order-delivery-mark">
            <PlusIcon size={18} />
          </span>
          <p className="mt-3 text-sm text-ink-600">{t.account.accountNone}</p>
          <button type="button" onClick={() => open("new")} className="btn btn-primary btn-md mt-4">
            <PlusIcon size={15} />
            {t.account.accountAdd}
          </button>
        </div>
      )}

      {accounts.length > 0 && (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
            <li key={account.id} className={`addr-tile ${account.isDefault ? "is-default" : ""}`}>
              <div className="tile-head">
                <PaymentMark method={account.bank === "bog" ? "bog" : "tbc"} />
                <span className="min-w-0">
                  <span className="tile-title">{t.payment[account.bank === "bog" ? "bog" : "tbc"]}</span>
                  {account.isDefault && (
                    <span className="badge mt-1 bg-brand-50 text-brand-700">{t.account.addressDefault}</span>
                  )}
                </span>
                <span className="tile-acts">
                  <button
                    type="button"
                    onClick={() => open(account.id)}
                    aria-label={`${t.account.accountEdit} — ${account.iban}`}
                    className="btn btn-ghost h-9 w-9 rounded-pill p-0"
                  >
                    <PencilIcon size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!window.confirm(t.account.accountDeleteConfirm)) return;
                      act(() => deleteRefundAccount(account.id));
                    }}
                    aria-label={`${t.account.addressDelete} — ${account.iban}`}
                    className="btn btn-ghost h-9 w-9 rounded-pill p-0 text-ink-400 hover:text-danger"
                  >
                    <TrashIcon size={15} />
                  </button>
                </span>
              </div>

              {/* The number in its own box, as it is at the checkout: it
                  is the one thing on the tile that gets read out. */}
              <p className="tile-iban">{account.iban}</p>
              {account.holder && <p className="mt-1.5 text-center text-sm break-words text-ink-500">{account.holder}</p>}

              {!account.isDefault && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => act(() => makeDefaultRefundAccount(account.id))}
                  className="btn btn-outline btn-sm mt-3 w-full"
                >
                  <CheckIcon size={14} />
                  {t.account.addressMakeDefault}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        /* `key`, so switching from one account to another remounts the
           fields rather than keeping the first one's number. */
        <form
          key={editing}
          onSubmit={submit}
          /* The shop says what is missing, in the shop's language, on the
             box it is about. `required` stays for what it means to a
             screen reader; the browser's own bubble is turned off. */
          noValidate
          className={`grid gap-x-4 gap-y-3 sm:grid-cols-2 ${accounts.length > 0 ? "mt-6 border-t border-line pt-6" : "mt-2"}`}
        >
          {current && <input type="hidden" name="id" value={current.id} />}

          <h3 className="display-sm text-ink-900 sm:col-span-2">
            {current ? t.account.accountEdit : t.account.accountAdd}
          </h3>

          {/* Which bank: the two the shop deals with, as two cards. */}
          <div className="sm:col-span-2">
            <span className="field-label block text-center sm:text-left">{t.account.accountBank}</span>
            <div className="bank-picks">
              {(["tbc", "bog"] as const).map((id) => (
                <label key={id} className={`bank-pick ${bank === id ? "is-on" : ""}`}>
                  <input
                    type="radio"
                    name="bank"
                    value={id}
                    checked={bank === id}
                    onChange={() => setBank(id)}
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
          </div>

          <div>
            <label htmlFor="account-iban" className="field-label">
              {t.account.refundIban}
            </label>
            <input
              id="account-iban"
              name="iban"
              defaultValue={current?.iban ?? ""}
              placeholder="GE00XX0000000000000000"
              autoComplete="off"
              spellCheck={false}
              required
              aria-invalid={ibanBad || undefined}
              onChange={() => ibanBad && setIbanBad(false)}
              className="field font-mono"
            />
          </div>

          <div>
            <label htmlFor="account-holder" className="field-label">
              {t.account.refundName}
            </label>
            <input
              id="account-holder"
              name="holder"
              defaultValue={current?.holder ?? ""}
              autoComplete="name"
              required
              aria-invalid={holderBad || undefined}
              onChange={() => holderBad && setHolderBad(false)}
              className="field"
            />
          </div>

          {!(current?.isDefault ?? false) && accounts.length > 0 && (
            <label className="mt-1 flex items-center gap-2 text-sm text-ink-600 sm:col-span-2">
              <input type="checkbox" name="isDefault" className="h-4 w-4 accent-brand-600" />
              {t.account.addressMakeDefault}
            </label>
          )}

          <div className="mt-2 flex flex-col gap-2 sm:col-span-2 sm:flex-row">
            <button type="submit" disabled={isPending || !bank} className="btn btn-primary btn-md">
              {isPending && <SpinnerIcon size={14} />}
              {t.account.addressSave}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn btn-outline btn-md">
              {t.account.addressCancel}
            </button>
          </div>
        </form>
      ) : full ? (
        <p className="mt-4 text-center text-xs text-ink-400 sm:text-left">{t.account.accountFull}</p>
      ) : accounts.length > 0 ? (
        <button type="button" onClick={() => open("new")} className="btn btn-outline btn-md mt-5 w-full sm:w-auto">
          <PlusIcon size={15} />
          {t.account.accountAdd}
        </button>
      ) : null}
    </section>
  );
}
