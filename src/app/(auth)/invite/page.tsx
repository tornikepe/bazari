"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { AuthCard } from "@/components/auth/AuthCard";
import { acceptInvite, type AuthState } from "@/app/actions/auth";
import { SpinnerIcon } from "@/components/ui/icons";
import { FormFault, useFieldShake } from "@/components/ui/field-fault";

/**
 * Accepting a staff invitation.
 *
 * The link carries the whole authorisation, so there is no email field and
 * nothing to identify: asking for an address here would only invite someone
 * to type the wrong one. The page asks for a password twice and nothing else.
 */
function InviteForm() {
  const { t } = useI18n();
  const token = useSearchParams().get("token") ?? "";
  const [state, formAction, pending] = useActionState<AuthState, FormData>(acceptInvite, {});

  const bad = Boolean(state.error);
  useFieldShake(state, bad, ["password", "confirmPassword"]);

  const message =
    state.error === "weak"
      ? t.auth.weak
      : state.error === "mismatch"
        ? t.auth.mismatch
        : state.error === "expired"
          ? t.auth.inviteExpired
          : t.common.error;

  return (
    <AuthCard title={t.auth.inviteTitle} hint={t.auth.inviteHint} footer={null}>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />

        <div>
          <label className="field-label" htmlFor="password">
            {t.auth.password}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            autoFocus
            aria-invalid={bad || undefined}
            className="field"
          />
          <p className="mt-1 text-xs text-ink-400">{t.auth.passwordHint}</p>
        </div>

        <div>
          <label className="field-label" htmlFor="confirmPassword">
            {t.auth.confirmPassword}
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={bad || undefined}
            className="field"
          />
        </div>

        <FormFault message={state.error ? message : null} />

        <button
          type="submit"
          disabled={pending || !token}
          className="btn btn-primary btn-md w-full"
        >
          {pending && <SpinnerIcon size={16} />}
          {t.auth.inviteAccept}
        </button>
      </form>
    </AuthCard>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteForm />
    </Suspense>
  );
}
