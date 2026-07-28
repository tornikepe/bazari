"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { AuthCard } from "@/components/auth/AuthCard";
import { resendVerification, verifyEmail, type AuthState } from "@/app/actions/auth";
import { AlertIcon, SpinnerIcon } from "@/components/ui/icons";
import { fill } from "@/lib/i18n";

function VerifyForm() {
  const { t } = useI18n();
  const params = useSearchParams();

  const email = params.get("email") ?? "";

  const [state, formAction, pending] = useActionState<AuthState, FormData>(verifyEmail, {});
  const [resendState, resendAction, resending] = useActionState<AuthState, FormData>(
    resendVerification,
    {},
  );

  const message =
    state.error === "expired"
      ? t.auth.expired
      : state.error === "too-many-attempts"
        ? t.auth.tooManyAttempts
        : t.auth.invalid;

  return (
    <AuthCard
      title={t.auth.verifyTitle}
      hint={fill(t.auth.verifyHint, { email })}
      footer={
        <Link href="/account" className="font-semibold text-brand-600 hover:underline">
          {t.auth.skipForNow}
        </Link>
      }
    >
      <form action={formAction} className="mt-4 flex flex-col gap-4">
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
            autoFocus
            className="field text-center font-mono text-lg tracking-[0.4em]"
          />
          <p className="mt-1 text-xs text-ink-400">{t.auth.codeHint}</p>
        </div>

        {state.error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-control bg-danger-soft p-3 text-xs text-danger"
          >
            <AlertIcon size={15} className="shrink-0" />
            {message}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary btn-md w-full">
          {pending && <SpinnerIcon size={16} />}
          {pending ? t.auth.verifying : t.auth.verify}
        </button>
      </form>

      <form action={resendAction} className="mt-3">
        <input type="hidden" name="email" value={email} />

        {/* Says the same thing whether or not the address is registered — the
            action deliberately can't tell us, so neither can this. */}
        {resendState.sent && !resending && (
          <p className="mb-2 text-center text-xs font-semibold text-success">
            {t.auth.codeResent}
          </p>
        )}

        <button type="submit" disabled={resending} className="btn btn-ghost btn-sm w-full">
          {resending && <SpinnerIcon size={15} />}
          {t.auth.resend}
        </button>
      </form>
    </AuthCard>
  );
}

export default function VerifyPage() {
  // `useSearchParams` needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
