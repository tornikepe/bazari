import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { AccountShell, AccountCardHead } from "@/components/account/AccountShell";
import { PaymentPrefsForm } from "@/components/account/PaymentPrefsForm";

/**
 * The customer's payment page: where a refund should go — the bank and the
 * account — and the company line an invoice should carry. Which way to pay
 * is chosen at the checkout, on the order it belongs to, and not kept here.
 */
export default async function AccountPaymentsPage() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/payments");

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      refundBank: true,
      refundIban: true,
      refundName: true,
      invoiceCompany: true,
      invoiceTaxId: true,
    },
  });

  return (
    <AccountShell user={user} t={t}>
      <AccountCardHead title={t.account.menuPayments} />
      <div className="account-card-body">
        <PaymentPrefsForm
          prefs={{
            refundBank: row?.refundBank ?? "",
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
