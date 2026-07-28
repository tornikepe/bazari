"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { AuthCard } from "@/components/auth/AuthCard";
import { requestPasswordReset, resetPassword, type AuthState } from "@/app/actions/auth";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");

  const [requestState, requestAction, requesting] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  );
  const [resetState, resetAction, resetting] = useActionState<AuthState, FormData>(
    resetPassword,
    {},
  );

  // Once a code has been requested the form switches to the code + new
  // password step; the address is carried over in a hidden field.
  const codeSent = Boolean(requestState.sent);

  const message = (state: AuthState) =>
    state.error === "weak"
      ? t.auth.weak
      : state.error === "mismatch"
        ? t.auth.mismatch
        : state.error === "expired"
          ? t.auth.expired
          : state.error === "too-many-attempts"
            ? t.auth.tooManyAttempts
            : state.error === "rate-limited"
              ? fill(t.auth.rateLimited, { minutes: String(state.retryMinutes ?? 60) })
              : t.auth.invalid;

  return (
    <AuthCard
      title={t.auth.forgotTitle}
      hint={codeSent ? t.auth.codeHint : t.auth.forgotHint}
      footer={
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          {t.auth.backToSignIn}
        </Link>
      }
    >
      {!codeSent ? (
        <form action={requestAction} className="mt-5 flex flex-col gap-4">
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
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
            />
          </div>

          {requestState.error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-control bg-danger-soft p-3 text-xs text-danger"
            >
              <AlertIcon size={15} className="shrink-0" />
              {message(requestState)}
            </p>
          )}

          <button type="submit" disabled={requesting} className="btn btn-primary btn-md w-full">
            {requesting && <SpinnerIcon size={16} />}
            {requesting ? t.auth.sending : t.auth.sendCode}
          </button>
        </form>
      ) : (
        <form action={resetAction} className="mt-5 flex flex-col gap-4">
          <p className="flex items-center gap-2 rounded-control bg-success-soft p-3 text-xs text-success">
            <CheckIcon size={15} className="shrink-0" />
            {t.auth.codeSent}
          </p>


          <input type="hidden" name="email" value={email} />

          <div>
            <label className="field-label" htmlFor="code">
              {t.auth.code}
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className="field text-center font-mono text-lg tracking-[0.4em]"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              {t.auth.newPassword}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="field"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="confirmPassword">
              {t.auth.confirmPassword}
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="field"
            />
          </div>

          {resetState.error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-control bg-danger-soft p-3 text-xs text-danger"
            >
              <AlertIcon size={15} className="shrink-0" />
              {message(resetState)}
            </p>
          )}

          <button type="submit" disabled={resetting} className="btn btn-primary btn-md w-full">
            {resetting && <SpinnerIcon size={16} />}
            {resetting ? t.auth.resetting : t.auth.resetPassword}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
