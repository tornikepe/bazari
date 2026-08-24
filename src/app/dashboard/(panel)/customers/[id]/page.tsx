import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RoleBadge } from "@/components/admin/RoleBadge";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { countText } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Figures } from "@/components/ui/Figures";
import { CustomerSwitch } from "@/components/admin/CustomerSwitch";

/**
 * One customer, and everything the shop actually knows about them.
 *
 * No behavioural profile, no invented segments, no "likely to churn" score:
 * the panels below are their contact details as they typed them and the orders
 * they placed. Anything else would be a number this shop has not earned.
 */
export default async function AdminCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { locale, t } = await getI18n();

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      city: true,
      address: true,
      role: true,
      emailVerified: true,
      disabledAt: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          total: true,
          status: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });

  if (!user) notFound();

  // Cancelled orders are money that never arrived; counting them would flatter
  // every customer who ever changed their mind.
  const paid = user.orders.filter((order) => order.status !== "cancelled");
  const spend = paid.reduce((sum, order) => sum + order.total, 0);
  const average = paid.length > 0 ? Math.round(spend / paid.length) : 0;

  const details = [
    { label: t.admin.email, value: user.email },
    { label: t.checkout.phone, value: user.phone || "—" },
    { label: t.checkout.city, value: user.city || "—" },
    { label: t.checkout.address, value: user.address || "—" },
    { label: t.admin.customerSince, value: formatDate(user.createdAt) },
    {
      label: t.admin.status,
      value: user.emailVerified ? t.admin.verified : t.admin.unverified,
    },
  ];

  const figures = [
    { label: t.admin.customerOrders, value: String(user.orders.length) },
    { label: t.admin.customerSpend, value: formatPrice(spend, locale) },
    { label: t.admin.avgOrder, value: formatPrice(average, locale) },
    {
      label: t.admin.lastOrder,
      value: user.orders[0] ? formatDate(user.orders[0].createdAt) : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <ReadOnlyNotice />

      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1 text-sm text-ink-500 transition-colors hover:text-brand-600"
      >
        <ChevronLeftIcon size={15} />
        {t.admin.customers}
      </Link>

      <PageHeader
        className="mt-3"
        scale="panel"
        title={user.name || user.email}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={user.role} t={t} />
            {/* Only customers. A staff account is switched on and off on the
                staff page, which knows about the last admin. */}
            {user.role === "customer" && (
              <CustomerSwitch id={user.id} disabled={user.disabledAt !== null} />
            )}
          </div>
        }
      />

      <Figures className="mt-5" items={figures} columns={4} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="card overflow-hidden">
          <h2 className="card-head text-sm font-bold text-ink-900">
            {t.admin.contactDetails}
          </h2>
          <dl className="divide-y divide-line">
            {details.map((detail) => (
              <div key={detail.label} className="flex items-start justify-between gap-4 px-5 py-2.5">
                <dt className="shrink-0 text-xs text-ink-500">{detail.label}</dt>
                <dd className="text-right text-xs font-medium text-ink-800">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card overflow-hidden">
          <h2 className="card-head text-sm font-bold text-ink-900">
            {t.account.myOrders}
          </h2>

          {user.orders.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-400">{t.admin.noOrdersYet}</p>
          ) : (
            <ul className="divide-y divide-line">
              {user.orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-bold text-ink-900">{order.number}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {formatDateTime(order.createdAt)} · {countText(t.admin.productCountOne, t.admin.productCount, order._count.items)}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-ink-900">
                      {formatPrice(order.total, locale)}
                    </p>

                    <StatusBadge status={order.status} t={t} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
