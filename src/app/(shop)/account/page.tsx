import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ProfileForm } from "@/components/account/ProfileForm";
import { SignOutButton } from "@/components/account/SignOutButton";
import { BagIcon, HeartIcon, PackageIcon, TagIcon } from "@/components/ui/icons";
import type { RawSearchParams } from "@/lib/filters";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const justSaved = params.saved === "1";

  // The layout already guarantees a signed-in customer.
  const user = (await getCurrentUser())!;

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
    take: 20,
  });

  const spent = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total, 0);

  const stats = [
    { icon: BagIcon, label: t.account.ordersCount, value: String(orders.length) },
    { icon: TagIcon, label: t.account.spentTotal, value: formatPrice(spent, locale) },
  ];

  return (
    <div className="page-container py-6 lg:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">{t.account.title}</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
            {fill(t.account.greeting, { name: user.name || user.email })}
          </h1>
        </div>

        <SignOutButton label={t.auth.signOut} />
      </div>

      {/* -------------------------------- stats ------------------------------ */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex items-center gap-3.5 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-600">
              <stat.icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{stat.label}</p>
              <p className="truncate text-lg font-extrabold tracking-tight text-ink-900">
                {stat.value}
              </p>
            </div>
          </div>
        ))}

        <Link
          href="/favorites"
          className="card flex items-center gap-3.5 p-4 transition-shadow hover:shadow-lift"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-600">
            <HeartIcon size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-ink-500">{t.account.savedItems}</p>
            <p className="truncate text-lg font-extrabold tracking-tight text-ink-900">
              {t.favorites.title}
            </p>
          </div>
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {/* ------------------------------ orders ----------------------------- */}
        <section id="orders" className="card overflow-hidden scroll-mt-[calc(var(--header-h)+1rem)]">
          <h2 className="border-b border-line px-5 py-3.5 text-sm font-bold text-ink-900">
            {t.account.myOrders}
          </h2>

          {orders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-pill bg-ink-100 text-ink-400">
                <PackageIcon size={26} />
              </span>
              <p className="text-sm font-semibold text-ink-900">{t.account.noOrders}</p>
              <p className="max-w-xs text-sm text-ink-500">{t.account.noOrdersHint}</p>
              <Link href="/catalog" className="btn btn-primary btn-sm mt-1">
                {t.catalog.title}
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/order/${order.number}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-bold text-ink-900">{order.number}</p>
                      <p className="text-xs text-ink-400">
                        {formatDate(order.createdAt)} · {order._count.items}{" "}
                        {t.admin.productCount}
                      </p>
                    </div>

                    <p className="text-sm font-bold text-ink-900">
                      {formatPrice(order.total, locale)}
                    </p>

                    <StatusBadge status={order.status} t={t} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ------------------------------ profile ---------------------------- */}
        <ProfileForm user={user} justSaved={justSaved} />
      </div>
    </div>
  );
}
