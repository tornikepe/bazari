"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import {
  changePassword,
  updateConsent,
  updateEmail,
  updatePhone,
  type AuthState,
} from "@/app/actions/auth";
import { PhoneField } from "@/components/ui/PhoneField";
import { PasswordField } from "@/components/ui/PasswordField";
import { AlertIcon, CalendarIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";
import { FormFault, useFieldShake } from "@/components/ui/field-fault";
import type { Dictionary } from "@/lib/i18n";

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

/** Which of the three editors is open; one at a time. */
type Editor = "phone" | "email" | "password" | null;

/* One field: the label, the value or the control, the rule. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="profile-field">
      <span className="profile-label">{label}</span>
      {children}
    </div>
  );
}

/* A value that is only read, "—" when there is none. */
function Value({ text, muted, fallback }: { text: string; muted?: boolean; fallback: string }) {
  return <span className={`profile-value ${muted || !text ? "text-ink-400" : ""}`}>{text || fallback}</span>;
}

/* The word at the right of a field that opens its editor. */
function EditLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="profile-edit"
    >
      {label}
    </button>
  );
}

/* The foot of an open editor: save, and the way back. */
function EditorFoot({
  pending,
  onCancel,
  t,
}: {
  pending: boolean;
  onCancel: () => void;
  t: Dictionary;
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <button type="submit" disabled={pending} className="btn btn-primary btn-sm">
        {pending && <SpinnerIcon size={14} />}
        {t.account.saveProfile}
      </button>
      <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">
        {t.account.cancel}
      </button>
    </div>
  );
}

/**
 * The customer's details, laid out as the reference shop lays them: two
 * columns of label-over-value with a rule under each. Three of them — the
 * mobile, the address, the password — change in place, each behind its
 * own "edit" at the right of the row; the rest is read only. The two
 * consents under everything save the moment they are ticked.
 */
export function ProfileCard({ profile, saved }: { profile: Profile; saved: string | null }) {
  const { t } = useI18n();
  const [editor, setEditor] = useState<Editor>(null);

  const [phoneState, phoneAction, phonePending] = useActionState<AuthState, FormData>(updatePhone, {});
  const [emailState, emailAction, emailPending] = useActionState<AuthState, FormData>(updateEmail, {});
  const [passwordState, passwordAction, passwordPending] = useActionState<AuthState, FormData>(
    changePassword,
    {},
  );

  useFieldShake(phoneState, Boolean(phoneState.error), ["phone"]);
  useFieldShake(emailState, Boolean(emailState.error), ["email"]);
  useFieldShake(
    passwordState,
    Boolean(passwordState.error),
    passwordState.error === "wrong-password" ? ["currentPassword"] : ["newPassword", "confirmPassword"],
  );

  const phoneFault =
    phoneState.error === "phone"
      ? t.auth.phoneInvalid
      : phoneState.error === "phone-taken"
        ? t.auth.phoneTaken
        : phoneState.error
          ? t.common.error
          : null;
  const emailFault =
    emailState.error === "taken" ? t.auth.taken : emailState.error ? t.common.error : null;
  const passwordFault =
    passwordState.error === "wrong-password"
      ? t.account.wrongPassword
      : passwordState.error === "weak"
        ? t.auth.weak
        : passwordState.error === "mismatch"
          ? t.auth.mismatch
          : passwordState.error
            ? t.common.error
            : null;

  const [firstName, ...rest] = profile.name.split(" ");
  const lastName = rest.join(" ");
  const birth = profile.birthDate ? new Date(profile.birthDate) : null;
  const birthShown = birth
    ? `${String(birth.getUTCDate()).padStart(2, "0")} / ${String(birth.getUTCMonth() + 1).padStart(2, "0")} / ${birth.getUTCFullYear()}`
    : "";
  const genderShown =
    profile.gender === "female" ? t.account.genderFemale : profile.gender === "male" ? t.account.genderMale : "";
  const privacy = <Link href="/privacy" className="underline underline-offset-4">{t.account.optInHere}</Link>;

  const savedLine =
    saved === "phone"
      ? t.account.phoneSaved
      : saved === "password"
        ? t.account.passwordSaved
        : saved
          ? t.account.profileSaved
          : null;

  return (
    <div className="profile">
      {savedLine && !editor && (
        <p role="status" className="mb-5 flex items-center gap-1.5 text-sm font-semibold text-success">
          <CheckIcon size={15} />
          {savedLine}
        </p>
      )}

      <div className="grid gap-x-16 gap-y-2 lg:grid-cols-2">
        <div>
          <Field label={t.account.firstName}>
            <Value text={firstName} fallback={t.account.notSet} />
          </Field>
          <Field label={t.account.lastName}>
            <Value text={lastName} fallback={t.account.notSet} />
          </Field>
          <Field label={t.account.gender}>
            <span className="profile-radios">
              {(["female", "male"] as const).map((option) => (
                <label key={option} className="pointer-events-none">
                  <input type="radio" name="gender" value={option} checked={profile.gender === option} readOnly disabled />
                  <span className="profile-radio" aria-hidden="true" />
                  <span className={profile.gender === option ? "text-ink-700" : "text-ink-400"}>
                    {option === "female" ? t.account.genderFemale : t.account.genderMale}
                  </span>
                </label>
              ))}
              {!genderShown && <span className="sr-only">{t.account.notSet}</span>}
            </span>
          </Field>
          <Field label={t.account.birthDate}>
            <span className="profile-row">
              <Value text={birthShown} fallback={t.account.notSet} />
              <CalendarIcon size={20} className="hidden shrink-0 text-ink-400 sm:block" aria-hidden="true" />
            </span>
          </Field>
          <Field label={t.account.personalId}>
            <Value text={profile.personalId} fallback={t.account.notSet} />
          </Field>
        </div>

        <div>
          {/* ------------------------------ email ------------------------------ */}
          <Field label={t.auth.email}>
            {editor === "email" ? (
              <form action={emailAction}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={profile.email}
                  required
                  autoFocus
                  autoComplete="email"
                  className="field"
                />
                <p className="mt-1.5 text-xs text-ink-500">{t.account.emailChangeHint}</p>
                <FormFault message={emailFault} />
                <EditorFoot pending={emailPending} onCancel={() => setEditor(null)} t={t} />
              </form>
            ) : (
              <span className="profile-row">
                <span className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
                  <Value text={profile.email} fallback={t.account.notSet} />
                  {!profile.emailVerified && (
                    <Link
                      href={`/verify?email=${encodeURIComponent(profile.email)}`}
                      className="text-xs font-semibold text-warning underline-offset-4 hover:underline"
                    >
                      {t.account.emailUnverified} →
                    </Link>
                  )}
                </span>
                <EditLink onClick={() => setEditor("email")} label={t.account.edit} />
              </span>
            )}
          </Field>

          {/* ------------------------------ phone ------------------------------ */}
          <Field label={t.account.mobile}>
            {editor === "phone" ? (
              <form action={phoneAction}>
                <PhoneField id="phone" name="phone" defaultValue={profile.phone} required invalid={Boolean(phoneFault)} />
                <FormFault message={phoneFault} />
                <EditorFoot pending={phonePending} onCancel={() => setEditor(null)} t={t} />
              </form>
            ) : (
              <span className="profile-row">
                <span className="profile-value">
                  <span className="text-ink-500">+995</span>{" "}
                  {profile.phone ? profile.phone.replace(/^\+995\s?/, "") : "---------"}
                </span>
                <EditLink onClick={() => setEditor("phone")} label={t.account.edit} />
              </span>
            )}
          </Field>
          {!profile.phone && editor !== "phone" && (
            <p className="-mt-2 mb-4 flex items-center gap-2 text-sm text-ink-500">
              <AlertIcon size={16} className="shrink-0" />
              {t.account.addMobile}
            </p>
          )}

          {/* ----------------------------- password ---------------------------- */}
          <Field label={t.account.password}>
            {editor === "password" ? (
              <form action={passwordAction} className="flex flex-col gap-3">
                <div>
                  <label htmlFor="currentPassword" className="field-label">
                    {t.account.currentPassword}
                  </label>
                  <PasswordField
                    id="currentPassword"
                    name="currentPassword"
                    required
                    autoFocus
                    autoComplete="current-password"
                    invalid={passwordState.error === "wrong-password"}
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="field-label">
                    {t.auth.newPassword}
                  </label>
                  <PasswordField
                    id="newPassword"
                    name="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    invalid={passwordState.error === "weak" || passwordState.error === "mismatch"}
                  />
                  <p className="mt-1 text-xs text-ink-400">{t.auth.passwordHint}</p>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="field-label">
                    {t.auth.confirmPassword}
                  </label>
                  <PasswordField
                    id="confirmPassword"
                    name="confirmPassword"
                    required
                    autoComplete="new-password"
                    invalid={passwordState.error === "mismatch"}
                  />
                </div>
                <FormFault message={passwordFault} />
                <EditorFoot pending={passwordPending} onCancel={() => setEditor(null)} t={t} />
              </form>
            ) : (
              <span className="profile-row">
                <span className="profile-value tracking-[0.2em]">••••••••••••</span>
                <EditLink onClick={() => setEditor("password")} label={t.account.edit} />
              </span>
            )}
          </Field>
        </div>
      </div>

      <Consents profile={profile} privacy={privacy} />
    </div>
  );
}

/**
 * The two consents, under everything: a tick saves itself. The box shows
 * the new state at once and goes back if the save fails.
 */
function Consents({ profile, privacy }: { profile: Profile; privacy: React.ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState({ smsOptIn: profile.smsOptIn, emailOptIn: profile.emailOptIn });
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  function toggle(key: "smsOptIn" | "emailOptIn") {
    const next = !state[key];
    setState((current) => ({ ...current, [key]: next }));
    setFailed(false);
    startTransition(async () => {
      const result = await updateConsent(key, next);
      if (!result.ok) {
        setState((current) => ({ ...current, [key]: !next }));
        setFailed(true);
      }
    });
  }

  return (
    <div className="mt-8 flex flex-col gap-3 text-sm text-ink-700">
      {(["smsOptIn", "emailOptIn"] as const).map((key) => (
        <label key={key} className="profile-check">
          <input type="checkbox" name={key} checked={state[key]} onChange={() => toggle(key)} />
          <span className="profile-box" aria-hidden="true">
            <CheckIcon size={12} strokeWidth={3} />
          </span>
          <span>
            {key === "smsOptIn" ? t.account.smsOptIn : t.account.emailOptIn} {t.account.optInMore} {privacy}
          </span>
        </label>
      ))}
      {failed && <FormFault message={t.common.error} />}
    </div>
  );
}
