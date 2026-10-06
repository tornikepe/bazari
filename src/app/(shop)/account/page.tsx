import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { AccountShell } from "@/components/account/AccountShell";
import { ProfilePanel } from "@/components/account/ProfilePanel";
import type { RawSearchParams } from "@/lib/filters";
import { formatDate, formatPrice } from "@/lib/format";

/**
 * The account itself: the customer's details, of which the mobile, the
 * address and the password change in place. The orders, the addresses and
 * the payment settings are the other rows of the menu.
 */
export default async function AccountPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      gender: true,
      birthDate: true,
      personalId: true,
      smsOptIn: true,
      emailOptIn: true,
      balance: true,
      balanceEntries: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, amount: true, reason: true, note: true, createdAt: true },
      },
    },
  });

  return (
    <AccountShell user={user} t={t}>
      {/* What the shop owes them, and what it is made of. Only once there
          is something: an account that has never reviewed anything does
          not need a card saying it has nothing. */}
      {row && row.balance > 0 && (
        <section className="card mb-4 card-pad">
          <p className="eyebrow">{t.admin.balance}</p>
          <p className="display-sm mt-1.5 text-success">{formatPrice(row.balance, locale)}</p>
          <p className="mt-1 text-xs leading-snug text-ink-500">{t.account.balanceHint}</p>

          <ul className="mt-4 divide-y divide-line border-t border-line">
            {row.balanceEntries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-4 py-2.5">
                <span className="min-w-0 text-xs leading-snug text-ink-700">
                  {entry.note || t.admin.balanceAdjustment}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-xs font-bold text-success tabular-nums">
                    +{formatPrice(entry.amount, locale)}
                  </span>
                  <span className="mt-0.5 block text-xs whitespace-nowrap text-ink-400">
                    {formatDate(entry.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
