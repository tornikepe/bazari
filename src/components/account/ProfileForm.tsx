"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { updateProfile, type AuthState } from "@/app/actions/auth";
import { CheckIcon } from "@/components/ui/icons";
import type { SessionUser } from "@/lib/auth";
import { Busy, Swap } from "@/components/ui/Swap";
import { PhoneField } from "@/components/ui/PhoneField";

export function ProfileForm({
  user,
  justSaved,
}: {
  user: SessionUser;
  justSaved: boolean;
}) {
  const { t } = useI18n();
  const [, formAction, pending] = useActionState<AuthState, FormData>(
    updateProfile,
    {},
  );

  return (
    <section
      id="profile"
      className="card scroll-mt-[calc(var(--header-h)+1rem)] card-pad"
    >
      <h2 className="text-sm font-bold text-ink-900">{t.account.profile}</h2>
      <p className="mt-1 text-xs text-ink-500">{t.account.profileHint}</p>

      {/* Two fields to a row from `sm` up: name beside phone, city beside
          street. Four full-width fields down a card the width of the page
          were a column of 900px inputs holding twelve characters each. */}
      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-2">
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
          <PhoneField id="phone" name="phone" defaultValue={user.phone} />
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

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-md"
          >
            <Swap
              show={
                pending ? (
                  <Busy label={t.account.saving} />
                ) : (
                  t.account.saveProfile
                )
              }
              of={[t.account.saveProfile]}
            />
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
