"use client";

import { useActionState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { login, type AuthState } from "@/app/actions/auth";
import { PasswordField } from "@/components/ui/PasswordField";
import { AlertIcon, SpinnerIcon } from "@/components/ui/icons";

/**
 * The sign-in, in the panel under the account icon: email or phone, the
 * password with its eye, one button, and the two ways out of it — an
 * account to create, a password forgotten. The same action the sign-in
 * page runs, told to come back to the page the panel was opened on.
 */
export function MiniLogin() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(login, {});

  return (
    <form action={formAction} className="flex flex-col gap-3 p-4">
      <input type="hidden" name="next" value={pathname === "/login" ? "/account" : pathname} />

      <div>
        <label className="field-label" htmlFor="mini-identifier">
          {t.auth.identifier}
        </label>
        <input
          id="mini-identifier"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="username"
          required
          className="field h-10"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="mini-password">
          {t.auth.password}
        </label>
        <PasswordField id="mini-password" name="password" autoComplete="current-password" required />
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-control bg-danger-soft p-2.5 text-xs text-danger"
        >
          <AlertIcon size={14} className="shrink-0" />
          {state.error === "rate-limited"
            ? fill(t.auth.rateLimited, { minutes: String(state.retryMinutes ?? 15) })
            : t.auth.invalid}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-md w-full">
        {pending && <SpinnerIcon size={16} />}
        {pending ? t.auth.signingIn : t.auth.signIn}
      </button>

      <div className="flex items-center justify-between gap-3 text-xs">
        <Link href="/register" className="font-semibold whitespace-nowrap text-brand-600 hover:underline">
          {t.auth.createAccount}
        </Link>
        <Link href="/forgot-password" className="whitespace-nowrap text-ink-500 hover:text-ink-900 hover:underline">
          {t.auth.forgot}
        </Link>
      </div>
    </form>
  );
}
