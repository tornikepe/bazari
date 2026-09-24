"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { BankIcon, CheckIcon, CopyIcon } from "@/components/ui/icons";

/**
 * Where to send a bank transfer, shown the moment that is the way chosen.
 *
 * The number is the thing being read, so it is set large and spaced in
 * the mono face and can be copied with one press — a shopper reading an
 * IBAN off a screen into a banking app is the moment a digit gets lost.
 * The payee and the bank sit under it as quiet rows. Drawn only when the
 * shop has entered an account; there is nothing worse to show at the
 * checkout than an empty box where the details should be.
 */
export function BankDetails() {
  const { t } = useI18n();
  const settings = useSettings();
  const [copied, setCopied] = useState(false);

  if (!settings.bankIban) return null;

  /* Four at a time, the way a bank prints it: an IBAN read in groups is an
     IBAN typed correctly. */
  const grouped = settings.bankIban.replace(/(.{4})/g, "$1 ").trim();

  async function copy() {
    try {
      await navigator.clipboard.writeText(settings.bankIban);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser that refuses the clipboard leaves the number on screen,
      // which is what it is there for.
    }
  }

  return (
    <div className="bank-card">
      <div className="bank-card-head">
        <span className="bank-card-mark" aria-hidden="true">
          <BankIcon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-900">{t.checkout.bankTitle}</p>
          <p className="mt-0.5 text-xs leading-snug text-ink-500">{t.checkout.bankHint}</p>
        </div>
      </div>

      <div className="bank-iban">
        <span className="bank-iban-label">{t.checkout.bankIban}</span>
        <span className="bank-iban-value">{grouped}</span>
        <button type="button" onClick={copy} className="bank-copy" aria-label={t.checkout.bankCopy}>
          {copied ? <CheckIcon size={14} strokeWidth={3} /> : <CopyIcon size={14} />}
          <span>{copied ? t.checkout.bankCopied : t.checkout.bankCopy}</span>
        </button>
      </div>

      <dl className="bank-rows">
        {settings.bankHolder && (
          <div>
            <dt>{t.checkout.bankHolder}</dt>
            <dd>{settings.bankHolder}</dd>
          </div>
        )}
        {settings.bankName && (
          <div>
            <dt>{t.checkout.bankName}</dt>
            <dd>{settings.bankName}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
