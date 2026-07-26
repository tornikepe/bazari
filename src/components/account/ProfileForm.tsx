"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { updateProfile, type AuthState } from "@/app/actions/auth";
import { CheckIcon, SpinnerIcon } from "@/components/ui/icons";
import type { SessionUser } from "@/lib/auth";

export function ProfileForm({
  user,
  justSaved,
}: {
  user: SessionUser;
  justSaved: boolean;
}) {
  const { t } = useI18n();
  const [, formAction, pending] = useActionState<AuthState, FormData>(updateProfile, {});

  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold text-ink-900">{t.account.profile}</h2>
      <p className="mt-1 text-xs text-ink-500">{t.account.profileHint}</p>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <div>
          <label className="field-label" htmlFor="name">
            {t.auth.name}
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={user.name}
            autoComplete="name"
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
            defaultValue={user.phone}
            autoComplete="tel"
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="city">
            {t.account.city}
          </label>
          <input
            id="city"
            name="city"
            defaultValue={user.city}
            autoComplete="address-level2"
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="address">
            {t.account.address}
          </label>
          <input
            id="address"
            name="address"
            defaultValue={user.address}
            autoComplete="street-address"
            className="field"
          />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="btn btn-primary btn-md">
            {pending && <SpinnerIcon size={16} />}
            {pending ? t.account.saving : t.account.saveProfile}
          </button>

          {justSaved && !pending && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
              <CheckIcon size={16} />
              {t.account.saved}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
