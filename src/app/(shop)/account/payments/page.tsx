import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { AccountShell, AccountCardHead } from "@/components/account/AccountShell";
import { RefundAccounts } from "@/components/account/RefundAccounts";
import { InvoiceLineForm } from "@/components/account/InvoiceLineForm";

/**
 * The customer's payment page: the accounts a refund can be sent to, kept
 * as a short list the way the addresses are, and the company line an
 * invoice should carry. Which way to pay is chosen at the checkout, on the
 * order it belongs to, and is not kept here.
 */
export default async function AccountPaymentsPage() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/payments");

  const [accounts, row] = await Promise.all([
    prisma.refundAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, bank: true, iban: true, holder: true, isDefault: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { invoiceCompany: true, invoiceTaxId: true },
    }),
  ]);

  return (
    <AccountShell user={user} t={t}>
      <AccountCardHead title={t.account.menuPayments} />
      <div className="account-card-body">
        <RefundAccounts accounts={accounts} />
        <div className="mt-7 border-t border-line pt-7">
          <InvoiceLineForm
            prefs={{
              invoiceCompany: row?.invoiceCompany ?? "",
              invoiceTaxId: row?.invoiceTaxId ?? "",
            }}
          />
        </div>
      </div>
    </AccountShell>
  );
}
