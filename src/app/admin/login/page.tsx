"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { login, type LoginState } from "@/app/actions/auth";
import { AlertIcon, SpinnerIcon } from "@/components/ui/icons";

export default function AdminLoginPage() {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-control bg-brand-600 text-lg font-black text-white">
            ბ
          </span>
          <span className="text-xl font-extrabold tracking-tight text-ink-900">
            Ba<span className="text-brand-600">zari</span>
          </span>
        </Link>

        <div className="card p-6">
          <h1 className="text-lg font-bold text-ink-900">{t.admin.login}</h1>
          <p className="mt-1 text-sm text-ink-500">{t.admin.loginHint}</p>

          <form action={formAction} className="mt-5 flex flex-col gap-4">
            <div>
              <label className="field-label" htmlFor="email">
                {t.admin.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                defaultValue="admin@bazari.ge"
                className="field"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="password">
                {t.admin.password}
              </label>
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
                {t.admin.invalidCredentials}
              </p>
            )}

            <button type="submit" disabled={pending} className="btn btn-primary btn-md w-full">
              {pending && <SpinnerIcon size={16} />}
              {pending ? t.admin.signingIn : t.admin.signIn}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-ink-400">
          {/* Demo project — the seeded credentials are shown on purpose. */}
          admin@bazari.ge / admin123
        </p>

        <div className="mt-2 text-center">
          <Link href="/" className="text-xs text-ink-500 hover:text-brand-600">
            {t.admin.backToShop}
          </Link>
        </div>
      </div>
    </div>
  );
}
