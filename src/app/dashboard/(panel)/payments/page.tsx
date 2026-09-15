import { getI18n } from "@/lib/locale";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { PaymentGateways } from "@/components/admin/PaymentGateways";
import { getAdapter } from "@/lib/payments";
import { sandboxEnabled } from "@/lib/payments/sandbox";
import { getGateways } from "@/lib/payments/gateways";
import { requestOrigin } from "@/lib/request-origin";

/**
 * The online gateways: TBC, Bank of Georgia, PayPal and crypto.
 *
 * Each is a card with a switch, a test-mode switch, the fields its adapter
 * asks for, and the callback URL to paste into the provider's portal.
 * Nothing about them lives in the environment: the shop's owner pastes a
 * bank's keys here the day the bank issues them, and the method is at the
 * checkout on the next order.
 */
export default async function PaymentsPage() {
  const [{ locale, t }, gateways, origin] = await Promise.all([
    getI18n(),
    getGateways(),
    requestOrigin(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.payments}
        lead={t.admin.paymentsHint}
      />

      <PaymentGateways
        locale={locale}
        sandbox={sandboxEnabled()}
        gateways={gateways.map((gateway) => {
          const adapter = getAdapter(gateway.provider);
          return {
            provider: gateway.provider,
            name: adapter.name,
            enabled: gateway.enabled,
            testMode: gateway.testMode,
            configured: gateway.configured,
            webhookUrl: `${origin}/api/payments/${gateway.provider}/webhook`,
            // The form never carries a secret back to the browser: only
            // whether one is stored, and every other field's value.
            fields: adapter.fields.map((field) => ({
              ...field,
              value: field.secret ? "" : (gateway.config[field.key] ?? ""),
              stored: field.secret
                ? Boolean(gateway.config[field.key])
                : undefined,
            })),
          };
        })}
      />
    </div>
  );
}
