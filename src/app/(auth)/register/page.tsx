"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { AuthCard } from "@/components/auth/AuthCard";
import { register, type AuthState } from "@/app/actions/auth";
import { AlertIcon, SpinnerIcon } from "@/components/ui/icons";

export default function RegisterPage() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(register, {});

  const message =
    state.error === "taken"
      ? t.auth.taken
      : state.error === "weak"
        ? t.auth.weak
        : state.error === "failed"
          ? t.auth.failed
          : t.auth.invalid;

  return (
    <AuthCard
      title={t.auth.signUpTitle}
      hint={t.auth.signUpHint}
      footer={
        <>
          {t.auth.hasAccount}{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:underline">
            {t.auth.signIn}
          </Link>
        </>
      }
    >
      <form action={formAction} className="mt-5 flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="name">
            {t.auth.name}
          </label>
          <input id="name" name="name" required autoComplete="name" className="field" />
        </div>

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
          <label className="field-label" htmlFor="phone">
            {t.auth.phone}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+995 5XX XX XX XX"
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="password">
            {t.auth.password}
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
          <p className="mt-1 text-xs text-ink-400">{t.auth.passwordHint}</p>
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
          {pending ? t.auth.signingUp : t.auth.signUp}
        </button>
      </form>
    </AuthCard>
  );
}
