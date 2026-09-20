import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { AccountShell, AccountCardHead } from "@/components/account/AccountShell";
import { AddressBook } from "@/components/account/AddressBook";
import { AvatarForm } from "@/components/account/AvatarForm";

/** The saved addresses, and the picture — the two things the profile card does not hold. */
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
      <div className="account-card-body flex flex-col gap-6">
        <AddressBook addresses={addresses} />
        <AvatarForm name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
      </div>
    </AccountShell>
  );
}
