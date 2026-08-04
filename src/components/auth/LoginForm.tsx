"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { AuthCard } from "@/components/auth/AuthCard";
import { login, type AuthState } from "@/app/actions/auth";
import { AlertIcon, SpinnerIcon } from "@/components/ui/icons";

export function LoginForm({
  next,
  social,
}: {
  next: string;
  social: React.ReactNode;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(login, {});

  return (
    <AuthCard
      title={t.auth.signInTitle}
      hint={t.auth.signInHint}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline">
            {t.auth.signUp}
          </Link>
        </>
      }
    >
      {social}

      <form action={formAction} className="mt-5 flex flex-col gap-4">
        {/* Carried through the sign-in so "you need an account to check out"
            returns to checkout. Validated server-side — it comes from the URL. */}
        <input type="hidden" name="next" value={next} />

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
            className="field"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="field-label" htmlFor="password">
              {t.auth.password}
            </label>
            <Link
              href="/forgot-password"
              className="mb-1.5 text-xs font-semibold text-brand-600 hover:underline"
            >
              {t.auth.forgot}
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="field"
          />
        </div>

        {state.error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-control bg-danger-soft p-3 text-xs text-danger"
          >
            <AlertIcon size={15} className="shrink-0" />
            {state.error === "rate-limited"
              ? fill(t.auth.rateLimited, { minutes: String(state.retryMinutes ?? 15) })
              : t.auth.invalid}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary btn-md w-full">
          {pending && <SpinnerIcon size={16} />}
          {pending ? t.auth.signingIn : t.auth.signIn}
        </button>
      </form>

      {/* Demo project — the seeded staff credentials are shown on purpose. */}
      <p className="mt-4 rounded-control bg-ink-50 p-2.5 text-center text-xs text-ink-500">
        {t.auth.demoNote}
      </p>
    </AuthCard>
  );
}
