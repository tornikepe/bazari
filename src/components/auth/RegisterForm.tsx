"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { AuthCard } from "@/components/auth/AuthCard";
import { register, type AuthState } from "@/app/actions/auth";
import { SpinnerIcon } from "@/components/ui/icons";
import { PasswordField } from "@/components/ui/PasswordField";
import { PhoneField } from "@/components/ui/PhoneField";
import { FormFault, useFieldShake } from "@/components/ui/field-fault";

export function RegisterForm({ social }: { social: React.ReactNode }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(register, {});

  /* Whether the two passwords differ is known before the form leaves the
     browser, so it is answered there: the second box turns red and shakes,
     and nothing is sent. Counted, not a boolean, so a second mismatch in a
     row shakes again. */
  const [mismatches, setMismatches] = useState(0);
  const [mismatch, setMismatch] = useState(false);

  function checkPasswords(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmPassword")) {
      event.preventDefault();
      setMismatch(true);
      setMismatches((count) => count + 1);
      event.currentTarget.querySelector<HTMLInputElement>("#confirmPassword")?.focus();
    }
  }

  /* Each thing the server can refuse is shown on the field it is about. */
  const error = state.error;
  const bad = {
    name: error === "failed" || error === "invalid",
    email: error === "taken" || error === "failed" || error === "invalid",
    phone: error === "phone" || error === "phone-taken" || error === "failed",
    password: error === "weak" || error === "failed" || error === "invalid",
    confirm: error === "mismatch" || error === "failed" || mismatch,
  };
  useFieldShake(
    state,
    Boolean(error),
    Object.entries(bad)
      .filter(([, is]) => is)
      .map(([key]) => (key === "confirm" ? "confirmPassword" : key)),
  );
  useFieldShake(mismatches, mismatch, ["confirmPassword"]);

  const fault = mismatch
    ? t.auth.mismatch
    : error === "taken"
      ? t.auth.taken
      : error === "phone"
        ? t.auth.phoneInvalid
        : error === "phone-taken"
          ? t.auth.phoneTaken
          : error === "weak"
            ? t.auth.weak
            : error === "mismatch"
              ? t.auth.mismatch
              : error === "failed"
                ? t.auth.failed
                : error
                  ? t.auth.invalid
                  : null;

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

      <form action={formAction} onSubmit={checkPasswords} className="mt-5 flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="name">
            {t.auth.name}
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            aria-invalid={bad.name || undefined}
            className="field"
          />
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
            aria-invalid={bad.email || undefined}
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="phone">
            {t.auth.phone}
            <span className="ml-0.5 text-brand-600">*</span>
          </label>
          <PhoneField id="phone" name="phone" required invalid={bad.phone} />
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
            invalid={bad.password}
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
            invalid={bad.confirm}
            onChange={() => mismatch && setMismatch(false)}
          />
        </div>

        <FormFault message={fault} />

        <button type="submit" disabled={pending} className="btn btn-primary btn-md w-full">
          {pending && <SpinnerIcon size={16} />}
          {pending ? t.auth.signingUp : t.auth.signUp}
        </button>
      </form>
    </AuthCard>
  );
}
