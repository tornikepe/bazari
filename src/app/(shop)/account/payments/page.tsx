import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { getSettings } from "@/lib/settings";
import { cardGateway } from "@/lib/payments";
import { enabledGateways } from "@/lib/payments/gateways";
import { AccountShell } from "@/components/account/AccountShell";
import { PaymentPrefsForm } from "@/components/account/PaymentPrefsForm";
import type { PaymentMethod } from "@/lib/payment";

/**
 * The customer's payment page: which of the shop's ways to pay the
 * checkout should have ready, where a refund should go, and the company
 * line an invoice should carry. The methods offered are the checkout's own
 * list, built the same way, so nothing can be chosen here that is not
 * there.
 */
export default async function AccountPaymentsPage() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/payments");

  const [row, gateways, settings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        preferredPayment: true,
        refundIban: true,
        refundName: true,
        invoiceCompany: true,
        invoiceTaxId: true,
      },
    }),
    enabledGateways(),
    getSettings(),
  ]);

  const methods: PaymentMethod[] = [
    ...gateways.map((gateway) => gateway.provider),
    ...(cardGateway() ? (["card"] as const) : []),
    "bank_transfer",
    ...(settings.codEnabled ? (["cash_on_delivery"] as const) : []),
  ];

  return (
    <AccountShell user={user} t={t}>
      <div className="mt-4">
        <PaymentPrefsForm
          methods={methods}
          prefs={{
            preferredPayment: row?.preferredPayment ?? null,
            refundIban: row?.refundIban ?? "",
            refundName: row?.refundName ?? "",
            invoiceCompany: row?.invoiceCompany ?? "",
            invoiceTaxId: row?.invoiceTaxId ?? "",
          }}
        />
      </div>
    </AccountShell>
  );
}
