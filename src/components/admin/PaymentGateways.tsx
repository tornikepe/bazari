"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { savePaymentGateway } from "@/app/actions/payment-gateways";
import { PaymentMark } from "@/components/checkout/PaymentMark";
import { Busy, Swap } from "@/components/ui/Swap";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CheckIcon } from "@/components/ui/icons";
import type { GatewayField } from "@/lib/payments/types";
import type { GatewayId } from "@/lib/payments/gateways";
import type { Locale } from "@/lib/i18n";

export type GatewayView = {
  provider: GatewayId;
  name: string;
  enabled: boolean;
  testMode: boolean;
  configured: boolean;
  webhookUrl: string;
  fields: (GatewayField & { value: string; stored?: boolean })[];
};

/** One card per gateway, each its own form. */
export function PaymentGateways({
  gateways,
  locale,
  sandbox,
}: {
  gateways: GatewayView[];
  locale: Locale;
  sandbox: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-5 flex flex-col gap-4">
      {sandbox && (
        <p className="card card-pad-tight text-xs text-ink-600">
          <span className="font-bold text-warning">PAYMENT_SANDBOX=1</span> —{" "}
          {t.admin.gatewaySandboxNote}
        </p>
      )}
      {gateways.map((gateway) => (
        <GatewayCard key={gateway.provider} gateway={gateway} locale={locale} />
      ))}
    </div>
  );
}

function GatewayCard({
  gateway,
  locale,
}: {
  gateway: GatewayView;
  locale: Locale;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "saved" | "failed" | "incomplete"
  >("idle");

  const badge = !gateway.enabled
    ? { label: t.admin.gatewayStatusOff, className: "bg-ink-100 text-ink-500" }
    : !gateway.configured
      ? {
          label: t.admin.gatewayStatusIncomplete,
          className: "bg-warning-soft text-warning",
        }
      : gateway.testMode
        ? {
            label: `${t.admin.gatewayStatusOn} · ${t.admin.gatewayStatusTest}`,
            className: "bg-info-soft text-info",
          }
        : {
            label: t.admin.gatewayStatusOn,
            className: "bg-success-soft text-success",
          };

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const wantsEnabled = formData.get("enabled") === "on";
    setStatus("idle");
    startTransition(async () => {
      const result = await savePaymentGateway(formData);
      if (!result.ok) {
        setStatus("failed");
        return;
      }
      setStatus(wantsEnabled && !result.configured ? "incomplete" : "saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="card card-pad">
      <input type="hidden" name="provider" value={gateway.provider} />

      <div className="flex flex-wrap items-center gap-3">
        <PaymentMark method={gateway.provider} />
        <h2 className="text-sm font-bold text-ink-900">{gateway.name}</h2>
        <span className={`badge ${badge.className}`}>{badge.label}</span>
      </div>

      <fieldset disabled={!canWrite} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={gateway.enabled}
              className="h-4 w-4 accent-brand-600"
            />
            {t.admin.gatewayEnabled}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              name="testMode"
              defaultChecked={gateway.testMode}
              className="h-4 w-4 accent-brand-600"
            />
            {t.admin.gatewayTestMode}
          </label>
        </div>
        <p className="-mt-2 text-xs text-ink-400">
          {t.admin.gatewayTestModeHint}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {gateway.fields.map((field) => (
            <div key={field.key} className={field.hint ? "sm:col-span-2" : ""}>
              <label
                htmlFor={`${gateway.provider}-${field.key}`}
                className="field-label"
              >
                {field.label[locale]}
                {field.optional && (
                  <span className="ml-1 font-normal text-ink-400">
                    ({t.admin.gatewayOptional})
                  </span>
                )}
              </label>
              <input
                id={`${gateway.provider}-${field.key}`}
                name={field.key}
                type={field.secret ? "password" : "text"}
                defaultValue={field.value}
                placeholder={field.secret ? "••••••••" : field.placeholder}
                autoComplete="off"
                spellCheck={false}
                className="field"
              />
              {field.secret && (
                <p
                  className={`mt-1 text-xs ${field.stored ? "text-success" : "text-ink-400"}`}
                >
                  {field.stored
                    ? t.admin.gatewaySecretSet
                    : t.admin.gatewaySecretUnset}
                </p>
              )}
              {field.hint && (
                <p className="mt-1 text-xs text-ink-400">
                  {field.hint[locale]}
                </p>
              )}
            </div>
          ))}
        </div>

        <div>
          <p className="field-label">{t.admin.gatewayWebhook}</p>
          <code className="block truncate rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink-700 select-all">
            {gateway.webhookUrl}
          </code>
          <p className="mt-1 text-xs text-ink-400">
            {t.admin.gatewayWebhookHint}
          </p>
        </div>

        {canWrite && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-primary btn-md"
            >
              <Swap
                show={
                  isPending ? <Busy label={t.admin.saving} /> : t.admin.save
                }
                of={[t.admin.save]}
              />
            </button>
            {status === "saved" && (
              <span
                role="status"
                className="flex items-center gap-1.5 text-sm font-semibold text-success"
              >
                <CheckIcon size={16} />
                {t.admin.gatewaySaved}
              </span>
            )}
            {status === "incomplete" && (
              <span
                role="status"
                className="text-sm font-semibold text-warning"
              >
                {t.admin.gatewayFieldsMissing}
              </span>
            )}
            {status === "failed" && (
              <ErrorNote
                title={t.admin.gatewaySaveFailed}
                hint={t.common.errorHint}
              />
            )}
          </div>
        )}
      </fieldset>
    </form>
  );
}
