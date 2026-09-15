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
      {/* One column, each card the width of the page. Two columns put a
          four-field form beside an address book that is three lines tall
          until an address is saved, and the page was half empty on the
          right; stacked, every card is as tall as what it holds. */}
      <div className="mt-4 flex flex-col gap-4">
        <AvatarForm
          name={user.name}
          email={user.email}
          avatarUrl={user.avatarUrl}
        />
        <ProfileForm user={user} justSaved={params.saved === "1"} />
        <AddressBook addresses={addresses} />
      </div>
    </AccountShell>
  );
}
