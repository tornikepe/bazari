import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { AccountShell } from "@/components/account/AccountShell";
import { ProfilePanel } from "@/components/account/ProfilePanel";
import type { RawSearchParams } from "@/lib/filters";

/**
 * The account itself: the customer's details, of which the mobile, the
 * address and the password change in place. The orders, the addresses and
 * the payment settings are the other rows of the menu.
 */
export default async function AccountPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { t } = await getI18n();
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { gender: true, birthDate: true, personalId: true, smsOptIn: true, emailOptIn: true },
  });

  return (
    <AccountShell user={user} t={t}>
      <ProfilePanel
        saved={typeof params.saved === "string" ? params.saved : null}
        profile={{
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          phone: user.phone,
          gender: row?.gender ?? "",
          birthDate: row?.birthDate ? row.birthDate.toISOString() : null,
          personalId: row?.personalId ?? "",
          smsOptIn: row?.smsOptIn ?? false,
          emailOptIn: row?.emailOptIn ?? false,
        }}
      />
    </AccountShell>
  );
}
