"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { AuthCard } from "@/components/auth/AuthCard";
import { signInWithRecoveryCode, type AuthState } from "@/app/actions/auth";
import { FormFault, useFieldShake } from "@/components/ui/field-fault";

/**
 * The way back into a staff account when the password is gone.
 *
 * Not "forgot password", which sends a link to a mailbox: this shop's staff
 * address is on a domain it receives no mail at, so that page can do nothing
 * for the people who run the shop. One of the eight codes made on the staff
 * page does instead.
 *
 * The code is spent on the way through and every other session is closed,
 * then the page it lands on asks for a new password — because somebody here
 * has either lost theirs or had it taken.
 *
 * Every refusal reads the same, whether the address is unknown, belongs to a
 * customer, or the code was simply wrong. Answering differently would make
 * this a way to find out who works here.
 */
export default function RecoverPage() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signInWithRecoveryCode,
    {},
  );

  useFieldShake(state, Boolean(state.error), ["code"]);

  const message =
    state.error === "rate-limited"
      ? fill(t.auth.rateLimited, { minutes: String(state.retryMinutes ?? 15) })
      : t.auth.recoverInvalid;

  return (
    <AuthCard
      title={t.auth.recoverTitle}
      hint={t.auth.recoverHint}
      footer={
        <Link
          href="/login"
          className="inline-block py-3 -my-3 font-semibold text-brand-600 hover:underline"
        >
          {t.auth.backToSignIn}
        </Link>
      }
    >
      <form action={action} className="mt-5 flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="email">
            {t.auth.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            aria-invalid={Boolean(state.error) || undefined}
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="code">
            {t.auth.recoverCode}
          </label>
          <input
            id="code"
            name="code"
            required
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={16}
            placeholder="xxxxx-xxxxx"
            aria-invalid={Boolean(state.error) || undefined}
            className="field text-center font-mono tracking-[0.2em] lowercase"
          />
          <p className="mt-1 text-xs text-ink-400">{t.auth.recoverCodeHint}</p>
        </div>

        <FormFault message={state.error ? message : null} />

        <button type="submit" disabled={pending} className="btn btn-primary btn-md w-full">
          {pending ? t.auth.signingIn : t.auth.recoverSubmit}
        </button>
      </form>
    </AuthCard>
  );
}
