import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { AccountShell } from "@/components/account/AccountShell";
import { AvatarForm } from "@/components/account/AvatarForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { AddressBook } from "@/components/account/AddressBook";
import type { RawSearchParams } from "@/lib/filters";

/**
 * The customer's own settings: their picture, the details the checkout
 * fills in for them, and their saved addresses. Its own page rather than a
 * column beside the orders, so a form is never beside a list that has
 * nothing to do with it.
 */
export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { t } = await getI18n();
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/settings");

  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  return (
    <AccountShell user={user} t={t}>
      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <AvatarForm
            name={user.name}
            email={user.email}
            avatarUrl={user.avatarUrl}
          />
          <ProfileForm user={user} justSaved={params.saved === "1"} />
        </div>
        <AddressBook addresses={addresses} />
      </div>
    </AccountShell>
  );
}
