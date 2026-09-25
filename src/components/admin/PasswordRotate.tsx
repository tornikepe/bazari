"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { generateStaffPassword } from "@/app/actions/auth";
import { AlertIcon, CheckIcon, CopyIcon, ShieldIcon } from "@/components/ui/icons";

/**
 * A new password for this account, made by the shop.
 *
 * The shop shipped with a password out of a seed script, and the one a
 * person picks for themselves is usually a word they already use
 * elsewhere. This makes twenty random characters, sets them, and shows
 * them once — after that only the hash exists and nobody can read it
 * back, including the shop.
 *
 * Shown once and said so plainly: the panel stays open until it is
 * dismissed, because a password nobody wrote down is an account nobody
 * can get into. Every other session is signed out at the same moment, so
 * this is also the button to press when a password may have leaked.
 */
export function PasswordRotate() {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  function make() {
    if (!window.confirm(t.admin.pwConfirm)) return;
    setFailed(false);
    startTransition(async () => {
      const result = await generateStaffPassword();
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setPassword(result.password);
    });
  }

  async function copy() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // A browser that refuses the clipboard leaves it on screen, which is
      // what it is there for.
    }
  }

  return (
    <section className="card mt-4 card-pad">
      <div className="flex items-start gap-3">
        <span className="order-delivery-mark">
          <ShieldIcon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-ink-900">{t.admin.pwTitle}</h2>
          <p className="mt-1 text-sm leading-snug text-ink-500">{t.admin.pwHint}</p>
        </div>
      </div>

      {password ? (
        <div className="mt-4 rounded-card border border-success/40 bg-success-soft p-4">
          <p className="label text-ink-600">{t.admin.pwNew}</p>
          <p className="mt-1.5 font-mono text-lg font-bold break-all text-ink-900 select-all">
            {password}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={copy} className="btn btn-outline btn-sm">
              {copied ? <CheckIcon size={14} strokeWidth={3} /> : <CopyIcon size={14} />}
              {copied ? t.admin.pwCopied : t.admin.pwCopy}
            </button>
            <button
              type="button"
              onClick={() => setPassword(null)}
              className="btn btn-ghost btn-sm text-ink-500"
            >
              {t.admin.pwDone}
            </button>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug font-semibold text-ink-700">
            <AlertIcon size={14} className="mt-px shrink-0 text-warning" />
            {t.admin.pwOnce}
          </p>
        </div>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={make}
          className="btn btn-primary btn-md mt-4"
        >
          {isPending ? t.admin.saving : t.admin.pwMake}
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
