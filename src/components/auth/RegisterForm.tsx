"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { AuthCard } from "@/components/auth/AuthCard";
import { register, type AuthState } from "@/app/actions/auth";
import { AlertIcon, SpinnerIcon } from "@/components/ui/icons";
import { PasswordField } from "@/components/ui/PasswordField";
import { PhoneField } from "@/components/ui/PhoneField";

export function RegisterForm({ social }: { social: React.ReactNode }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(register, {});

  const message =
    state.error === "taken"
      ? t.auth.taken
      : state.error === "phone"
        ? t.auth.phoneInvalid
        : state.error === "phone-taken"
          ? t.auth.phoneTaken
      : state.error === "weak"
        ? t.auth.weak
        : state.error === "mismatch"
          ? t.auth.mismatch
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
      {social}

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
            <span className="ml-0.5 text-brand-600">*</span>
          </label>
          <PhoneField id="phone" name="phone" required invalid={state.error === "phone" || state.error === "phone-taken"} />
        </div>

        <div>
          <label className="field-label" htmlFor="password">
            {t.auth.password}
          </label>
          <PasswordField
            id="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-ink-400">{t.auth.passwordHint}</p>
        </div>

        <div>
          <label className="field-label" htmlFor="confirmPassword">
            {t.auth.confirmPassword}
          </label>
          <PasswordField
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={8}
            autoComplete="new-password"
          />
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
