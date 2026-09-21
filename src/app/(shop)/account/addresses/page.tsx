import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { AccountShell, AccountCardHead } from "@/components/account/AccountShell";
import { AddressBook } from "@/components/account/AddressBook";

/** The saved addresses. */
export default async function AccountAddressesPage() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/addresses");

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <AccountShell user={user} t={t}>
      <AccountCardHead title={t.account.menuAddresses} />
      <div className="account-card-body">
        <AddressBook addresses={addresses} />
      </div>
    </AccountShell>
  );
}
