"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { saveSettings } from "@/app/actions/settings";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";
import type { ShopSettings } from "@/lib/settings-defaults";

/**
 * The shop's own settings.
 *
 * One form rather than a tab per section. Three groups of six fields is not
 * enough to hide behind tabs, and tabs would mean either three save buttons or
 * one that saves fields the reader cannot see — both worse than scrolling.
 *
 * Money is shown in lari and stored in tetri. The conversion happens in the
 * action, which is the same boundary the product form uses, so there is one
 * place in the write path where a decimal exists.
 */
export function SettingsForm({ settings }: { settings: ShopSettings }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveSettings(formData);
      setStatus(result.ok ? "saved" : "error");
      if (result.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
      <Section title={t.admin.settingsIdentity}>
        <Field
          name="name"
          label={t.admin.shopName}
          hint={t.admin.shopNameHint}
          defaultValue={settings.name}
          required
          disabled={!canWrite}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="titleSuffixKa"
            label={t.admin.titleSuffixKa}
            hint={t.admin.titleSuffixHint}
            defaultValue={settings.titleSuffixKa}
            disabled={!canWrite}
          />
          <Field
            name="titleSuffixEn"
            label={t.admin.titleSuffixEn}
            defaultValue={settings.titleSuffixEn}
            disabled={!canWrite}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="taglineKa"
            label={t.admin.taglineKa}
            hint={t.admin.taglineHint}
            defaultValue={settings.taglineKa}
            disabled={!canWrite}
          />
          <Field
            name="taglineEn"
            label={t.admin.taglineEn}
            defaultValue={settings.taglineEn}
            disabled={!canWrite}
          />
        </div>
        <Field
          name="logoUrl"
          label={t.admin.logoUrl}
          hint={t.admin.logoUrlHint}
          defaultValue={settings.logoUrl}
          disabled={!canWrite}
          placeholder="https://…"
        />
      </Section>

      <Section title={t.admin.settingsContact} note={t.admin.contactHint}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="contactEmail"
            label={t.admin.contactEmailField}
            type="email"
            defaultValue={settings.contactEmail}
            disabled={!canWrite}
          />
          <Field
            name="contactPhone"
            label={t.admin.contactPhoneField}
            defaultValue={settings.contactPhone}
            disabled={!canWrite}
          />
        </div>
        <Field
          name="contactAddress"
          label={t.admin.contactAddressField}
          defaultValue={settings.contactAddress}
          disabled={!canWrite}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="contactHoursKa"
            label={t.admin.contactHoursKa}
            defaultValue={settings.contactHoursKa}
            disabled={!canWrite}
          />
          <Field
            name="contactHoursEn"
            label={t.admin.contactHoursEn}
            defaultValue={settings.contactHoursEn}
            disabled={!canWrite}
          />
        </div>
      </Section>

      <Section title={t.admin.settingsShipping} note={t.admin.shippingHint}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="freeShippingThreshold"
            label={t.admin.freeShippingField}
            type="number"
            step="0.01"
            min="0"
            // Lari, not tetri. The action multiplies by 100.
            defaultValue={(settings.freeShippingThreshold / 100).toFixed(2)}
            required
            disabled={!canWrite}
          />
          <Field
            name="shippingFee"
            label={t.admin.shippingFeeField}
            type="number"
            step="0.01"
            min="0"
            defaultValue={(settings.shippingFee / 100).toFixed(2)}
            required
            disabled={!canWrite}
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            name="codEnabled"
            defaultChecked={settings.codEnabled}
            disabled={!canWrite}
            className="h-4 w-4"
          />
          {t.admin.codEnabled}
        </label>
      </Section>

      {canWrite && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
            {isPending && <SpinnerIcon size={16} />}
            {isPending ? t.admin.saving : t.admin.save}
          </button>

          {status === "saved" && !isPending && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-success">
              <CheckIcon size={15} />
              {t.admin.settingsSaved}
            </p>
          )}

          {status === "error" && !isPending && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
              <AlertIcon size={15} />
              {t.admin.settingsInvalid}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-bold text-ink-900">{title}</h2>
      {note && <p className="mt-1 text-xs leading-relaxed text-ink-500">{note}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({
  name,
  label,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>
        {label}
        {rest.required && <span className="ml-0.5 text-brand-600">*</span>}
      </label>
      <input id={name} name={name} className="field" {...rest} />
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}
