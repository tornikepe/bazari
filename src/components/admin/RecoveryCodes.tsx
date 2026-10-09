"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { generateRecoveryCodes } from "@/app/actions/auth";
import { AlertIcon, CheckIcon, CopyIcon, KeyIcon } from "@/components/ui/icons";

/**
 * Eight one-time codes, each of which gets this account back in once.
 *
 * Every other way back into an account goes through a mailbox, and this
 * shop's staff address is on a domain it receives no mail at — so a reset
 * link is sent nowhere and a code emailed at sign-in would lock the owner
 * out rather than protect them. These are what a bank prints on paper.
 *
 * They are also what makes the long random password safe to use: a password
 * nobody memorises is only a good password when losing it is survivable.
 *
 * Shown once, in a block meant to be copied somewhere that is not this
 * browser. Afterwards only the hashes exist, and nobody — the shop included
 * — can read them back.
 */
export function RecoveryCodes({ left }: { left: number }) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  function make() {
    if (left > 0 && !window.confirm(t.admin.recoveryConfirm)) return;
    setFailed(false);
    startTransition(async () => {
      const result = await generateRecoveryCodes();
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setCodes(result.codes);
    });
  }

  async function copy() {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser that refuses the clipboard leaves them on screen, which is
      // what they are there for.
    }
  }

  return (
    <section className="card mt-4 card-pad">
      <div className="flex items-start gap-3">
        <span className="order-delivery-mark">
          <KeyIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink-900">{t.admin.recoveryTitle}</h2>
          <p className="mt-1 text-sm leading-snug text-ink-500">{t.admin.recoveryHint}</p>
          <p
            className={`mt-1.5 text-xs leading-snug ${
              left > 0 ? "text-ink-400" : "font-semibold text-warning"
            }`}
          >
            {left > 0 ? fill(t.admin.recoveryLeft, { count: left }) : t.admin.recoveryNone}
          </p>
        </div>
      </div>

      {codes ? (
        <div className="mt-4 rounded-card border border-success/40 bg-success-soft p-4">
          <p className="label text-ink-600">{t.admin.recoveryNew}</p>
          <ul className="mt-2 grid gap-1 font-mono text-sm font-bold text-ink-900 select-all sm:grid-cols-2">
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} className="btn btn-outline btn-sm">
              {copied ? <CheckIcon size={14} strokeWidth={3} /> : <CopyIcon size={14} />}
              {copied ? t.admin.pwCopied : t.admin.pwCopy}
            </button>
            <button
              type="button"
              onClick={() => setCodes(null)}
              className="btn btn-ghost btn-sm text-ink-500"
            >
              {t.admin.pwDone}
            </button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug font-semibold text-ink-700">
            <AlertIcon size={14} className="mt-px shrink-0 text-warning" />
            {t.admin.recoveryOnce}
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={make}
          className={`btn btn-md mt-4 ${left > 0 ? "btn-outline" : "btn-primary"}`}
        >
          {isPending ? t.admin.saving : left > 0 ? t.admin.recoveryRemake : t.admin.recoveryMake}
        </button>
      )}

      {failed && (
        <p role="alert" className="mt-3 text-sm font-semibold text-danger">
          {t.common.error}
        </p>
      )}
    </section>
  );
}
