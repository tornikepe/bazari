"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { updateProfile, type AuthState } from "@/app/actions/auth";
import { PhoneField } from "@/components/ui/PhoneField";
import { AlertIcon, CalendarIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";
import { FormFault, useFieldShake } from "@/components/ui/field-fault";
import { localDigits } from "@/lib/phone";

export type Profile = {
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  gender: string;
  birthDate: string | null;
  personalId: string;
  smsOptIn: boolean;
  emailOptIn: boolean;
};

/* One field: the label, the value or the control, the rule. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="profile-field">
      <span className="profile-label">{label}</span>
      {children}
    </div>
  );
}

/**
 * The customer's details, laid out as the reference shop lays them: two
 * columns of label-over-value with a rule under each, read-only, and an
 * "edit" button at the card's head that turns the values into fields in
 * place. Save writes them all at once; cancel puts the values back.
 */
export function ProfileCard({
  profile,
  editing,
  onCancel,
  justSaved,
}: {
  profile: Profile;
  editing: boolean;
  onCancel: () => void;
  justSaved: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updateProfile, {});
  const dateRef = useRef<HTMLInputElement>(null);
  const [firstName, ...rest] = profile.name.split(" ");
  const lastName = rest.join(" ");

  useFieldShake(state, Boolean(state.error), state.error === "phone" ? ["phone"] : ["firstName"]);
  const fault = state.error ? (state.error === "phone" ? t.auth.phoneInvalid : t.common.error) : null;

  const birth = profile.birthDate ? new Date(profile.birthDate) : null;
  const birthShown = birth
    ? `${String(birth.getUTCDate()).padStart(2, "0")} / ${String(birth.getUTCMonth() + 1).padStart(2, "0")} / ${birth.getUTCFullYear()}`
    : t.account.notSet;
  const birthValue = birth ? birth.toISOString().slice(0, 10) : "";
  const genderShown =
    profile.gender === "female" ? t.account.genderFemale : profile.gender === "male" ? t.account.genderMale : "";
  const privacy = <Link href="/privacy" className="underline underline-offset-4">{t.account.optInHere}</Link>;

  const value = (text: string, muted = false) => (
    <span className={`profile-value ${muted ? "text-ink-400" : ""}`}>{text || t.account.notSet}</span>
  );

  return (
    <form action={formAction} className="profile" data-editing={editing}>
      {justSaved && !editing && (
        <p role="status" className="mb-5 flex items-center gap-1.5 text-sm font-semibold text-success">
          <CheckIcon size={15} />
          {t.account.profileSaved}
        </p>
      )}

      <div className="grid gap-x-16 gap-y-2 lg:grid-cols-2">
        <div>
          <Field label={t.account.firstName}>
            {editing ? (
              <input id="firstName" name="firstName" defaultValue={firstName} required className="profile-input" />
            ) : (
              value(firstName)
            )}
          </Field>
          <Field label={t.account.lastName}>
            {editing ? (
              <input id="lastName" name="lastName" defaultValue={lastName} className="profile-input" />
            ) : (
              value(lastName)
            )}
          </Field>
          <Field label={t.account.gender}>
            <span className="profile-radios">
              {(["female", "male"] as const).map((option) => (
                <label key={option} className={editing ? "" : "pointer-events-none"}>
                  <input
                    type="radio"
                    name="gender"
                    value={option}
                    defaultChecked={profile.gender === option}
                    disabled={!editing}
                  />
                  <span className="profile-radio" aria-hidden="true" />
                  <span className={profile.gender === option || editing ? "text-ink-700" : "text-ink-400"}>
                    {option === "female" ? t.account.genderFemale : t.account.genderMale}
                  </span>
                </label>
              ))}
              {!editing && !genderShown && <span className="sr-only">{t.account.notSet}</span>}
            </span>
          </Field>
          <Field label={t.account.birthDate}>
            <span className="flex items-center justify-between gap-3">
              {editing ? (
                <input ref={dateRef} type="date" name="birthDate" defaultValue={birthValue} className="profile-input" />
              ) : (
                value(birthShown, !birth)
              )}
              {/* The calendar is our mark, not the browser's: the native
                  indicator is hidden and this opens the same picker. */}
              {editing ? (
                <button
                  type="button"
                  onClick={() => dateRef.current?.showPicker?.()}
                  aria-label={t.account.birthDate}
                  className="shrink-0 text-ink-500 transition-colors hover:text-ink-900"
                >
                  <CalendarIcon size={20} />
                </button>
              ) : (
                <CalendarIcon size={20} className="shrink-0 text-ink-500" aria-hidden="true" />
              )}
            </span>
          </Field>
          <Field label={t.account.personalId}>
            {editing ? (
              <input
                name="personalId"
                defaultValue={profile.personalId}
                inputMode="numeric"
                maxLength={20}
                className="profile-input font-mono"
              />
            ) : (
              value(profile.personalId)
            )}
          </Field>
        </div>

        <div>
          <Field label={t.auth.email}>
            <span className="flex flex-wrap items-center justify-between gap-2">
              {value(profile.email)}
              {!profile.emailVerified && (
                <Link
                  href={`/verify?email=${encodeURIComponent(profile.email)}`}
                  className="text-xs font-semibold text-warning underline-offset-4 hover:underline"
                >
                  {t.account.emailUnverified} →
                </Link>
              )}
            </span>
          </Field>
          <Field label={t.account.mobile}>
            {editing ? (
              <PhoneField id="phone" name="phone" defaultValue={profile.phone} className="profile-phone" />
            ) : (
              <span className="profile-value">
                <span className="text-ink-500">+995</span>{" "}
                {profile.phone ? profile.phone.replace(/^\+995\s?/, "") : "---------"}
              </span>
            )}
          </Field>
          {!profile.phone && !editing && (
            <p className="-mt-2 mb-4 flex items-center gap-2 text-sm text-ink-500">
              <AlertIcon size={16} className="shrink-0" />
              {t.account.addMobile}
            </p>
          )}
          <Field label={t.account.password}>
            <span className="flex items-center justify-between gap-3">
              <span className="profile-value tracking-[0.2em]">••••••••••••</span>
              <Link href="/forgot-password" className="text-xs font-semibold text-brand-600 hover:underline">
                {t.account.changePassword}
              </Link>
            </span>
          </Field>
        </div>
      </div>

      {/* The two consents, under everything, with the way to what they mean. */}
      <div className="mt-8 flex flex-col gap-3 text-sm text-ink-700">
        {(["smsOptIn", "emailOptIn"] as const).map((key) => (
          <label key={key} className={`profile-check ${editing ? "" : "pointer-events-none"}`}>
            <input type="checkbox" name={key} defaultChecked={profile[key]} disabled={!editing} />
            <span className="profile-box" aria-hidden="true">
              <CheckIcon size={12} strokeWidth={3} />
            </span>
            <span>
              {key === "smsOptIn" ? t.account.smsOptIn : t.account.emailOptIn} {t.account.optInMore} {privacy}
            </span>
          </label>
        ))}
      </div>

      <FormFault message={fault} />

      {editing && (
        <div className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-5">
          <button type="button" onClick={onCancel} className="btn btn-outline btn-md">
            {t.account.cancel}
          </button>
          <button type="submit" disabled={pending} className="btn btn-primary btn-md">
            {pending && <SpinnerIcon size={15} />}
            {t.account.saveProfile}
          </button>
        </div>
      )}

    </form>
  );
}
