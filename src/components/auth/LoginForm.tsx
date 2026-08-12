"use client";

import { useActionState, useRef, useState } from "react";
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

  /**
   * Field errors the site writes, instead of the browser's own bubble.
   *
   * `required` alone hands the job to the user agent, which draws a tooltip in
   * *its* language rather than the shop's, in its own styling, anchored where
   * it likes, and gone the moment anything is clicked. On a Georgian shop it
   * says "Please fill out this field" in English.
   *
   * So the form is `noValidate` and says it itself: under the field it is about,
   * in the reader's language, tied to the input with `aria-describedby` so a
   * screen reader reaches it from the field rather than having to find it.
   */
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function validate(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const found: { email?: string; password?: string } = {};
    if (!email) found.email = t.auth.emailRequired;
    // Deliberately loose. The server is the authority on whether an address
    // exists; this only catches "no @ anywhere", which is a typo rather than a
    // judgement about what a valid address looks like.
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = t.auth.emailInvalid;

    if (!password) found.password = t.auth.passwordRequired;

    setErrors(found);

    if (found.email || found.password) {
      event.preventDefault();
      // Focus follows the complaint, so a keyboard or screen-reader user is
      // put where the problem is rather than told there is one somewhere.
      (found.email ? emailRef : passwordRef).current?.focus();
    }
  }

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

      <form action={formAction} onSubmit={validate} noValidate className="mt-5 flex flex-col gap-4">
        {/* Carried through the sign-in so "you need an account to check out"
            returns to checkout. Validated server-side — it comes from the URL. */}
        <input type="hidden" name="next" value={next} />

        <div>
          <label className="field-label" htmlFor="email">
            {t.auth.email}
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            onChange={() => errors.email && setErrors((current) => ({ ...current, email: undefined }))}
            className="field"
          />
          {errors.email && (
            <p id="email-error" className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
              <AlertIcon size={13} className="shrink-0" />
              {errors.email}
            </p>
          )}
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
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            onChange={() =>
              errors.password && setErrors((current) => ({ ...current, password: undefined }))
            }
            className="field"
          />
          {errors.password && (
            <p id="password-error" className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
              <AlertIcon size={13} className="shrink-0" />
              {errors.password}
            </p>
          )}
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
