import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SalesChart } from "@/components/admin/SalesChart";
import { getDashboardMetrics } from "@/lib/analytics";
import {
  AlertIcon,
  ArrowRightIcon,
  BagIcon,
  PackageIcon,
  TagIcon,
  TruckIcon,
} from "@/components/ui/icons";

export default async function DashboardPage() {
  const { locale, t } = await getI18n();

  const [
    productCount,
    orderCount,
    pendingCount,
    metrics,
    recentOrders,
    lowStock,
    topProducts,
    coupons,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),

    getDashboardMetrics(),

    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { _count: { select: { items: true } } },
    }),

    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { stock: "asc" },
      take: 8,
      select: { id: true, nameKa: true, nameEn: true, stock: true, lowStockAt: true },
    }),

    prisma.orderItem.groupBy({
      by: ["productId", "nameKa", "nameEn"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),

    prisma.coupon.findMany({
      where: { isActive: true },
      orderBy: { usedCount: "desc" },
      take: 4,
    }),
  ]);

  const { revenue, profit, units, avgOrder, marginPct, daily } = metrics;

  const needsRestock = lowStock.filter((product) => product.stock <= product.lowStockAt);

  const stats = [
    {
      label: t.admin.revenue30,
      value: formatPrice(revenue, locale),
      icon: TagIcon,
      tone: "bg-success-soft text-success",
      href: "/dashboard/orders",
    },
    {
      label: t.admin.grossProfit,
      value: formatPrice(profit, locale),
      hint: `${marginPct}% ${t.admin.margin}`,
      icon: BagIcon,
      tone: "bg-brand-100 text-brand-700",
      href: "/dashboard/orders",
    },
    {
      label: t.admin.unitsSold,
      value: String(units),
      hint: `${t.admin.avgOrder}: ${formatPrice(avgOrder, locale)}`,
      icon: PackageIcon,
      tone: "bg-info-soft text-info",
      href: "/dashboard/products",
    },
    {
      label: t.admin.pendingOrders,
      value: String(pendingCount),
      hint: `${orderCount} · ${productCount}`,
      icon: TruckIcon,
      tone: "bg-warning-soft text-warning",
      href: "/dashboard/orders?status=pending",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-extrabold tracking-tight text-ink-900">{t.admin.overview}</h1>

      {/* ------------------------------- stats ------------------------------ */}
      <div className="stagger mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="card hover-lift flex items-center gap-3.5 p-4"
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-control ${stat.tone}`}
            >
              <stat.icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{stat.label}</p>
              <p className="truncate text-lg font-extrabold tracking-tight text-ink-900">
                {stat.value}
              </p>
              {stat.hint && <p className="truncate text-xs text-ink-400">{stat.hint}</p>}
            </div>
          </Link>
        ))}
      </div>

      {/* ------------------------------- chart ------------------------------ */}
      <section className="card mt-4 p-5">
        <h2 className="text-sm font-bold text-ink-900">{t.admin.salesChart}</h2>
        <SalesChart data={daily} locale={locale} emptyLabel={t.admin.noSales} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* --------------------------- recent orders ------------------------ */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.recentOrders}</h2>
            <Link
              href="/dashboard/orders"
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              {t.home.viewAll}
              <ArrowRightIcon size={13} />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-400">{t.admin.noOrders}</p>
          ) : (
            <ul className="divide-y divide-line">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-bold text-ink-900">{order.number}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {order.customerName} · {order.city}
                      </p>
                    </div>

                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-ink-400">{formatDate(order.createdAt)}</p>
                      <p className="text-xs text-ink-400">
                        {order._count.items} {t.admin.productCount}
                      </p>
                    </div>

                    <p className="w-20 shrink-0 text-right text-sm font-bold text-ink-900">
                      {formatPrice(order.total, locale)}
                    </p>

                    <StatusBadge status={order.status} t={t} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          {/* --------------------------- top products ----------------------- */}
          <section className="card overflow-hidden">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-bold text-ink-900">{t.admin.topProducts}</h2>
              <p className="text-xs text-ink-400">{t.admin.topProductsHint}</p>
            </div>

            {topProducts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">{t.admin.noSales}</p>
            ) : (
              <ul className="divide-y divide-line">
                {topProducts.map((row) => (
                  <li
                    key={row.productId ?? row.nameKa}
                    className="flex items-center gap-3 px-5 py-2.5"
                  >
                    <span className="line-clamp-1 flex-1 text-xs text-ink-700">
                      {locale === "ka" ? row.nameKa : row.nameEn}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-ink-900">
                      {row._sum.quantity} {t.admin.soldUnits}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ----------------------------- low stock ------------------------ */}
          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
              <AlertIcon size={15} className="text-warning" />
              <h2 className="text-sm font-bold text-ink-900">{t.admin.lowStockTitle}</h2>
            </div>

            {needsRestock.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">{t.admin.lowStockEmpty}</p>
            ) : (
              <ul className="divide-y divide-line">
                {needsRestock.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-ink-50"
                    >
                      <span className="line-clamp-1 flex-1 text-xs text-ink-700">
                        {locale === "ka" ? product.nameKa : product.nameEn}
                      </span>
                      <span
                        className={`badge shrink-0 ${
                          product.stock === 0
                            ? "bg-danger-soft text-danger"
                            : "bg-warning-soft text-warning"
                        }`}
                      >
                        {product.stock}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------ coupons ------------------------- */}
          {coupons.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="border-b border-line px-5 py-3.5 text-sm font-bold text-ink-900">
                {t.admin.coupons}
              </h2>
              <ul className="divide-y divide-line">
                {coupons.map((coupon) => (
                  <li key={coupon.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="font-mono text-xs font-bold text-ink-900">{coupon.code}</span>
                    <span className="badge bg-brand-50 text-brand-700">
                      {coupon.percentOff
                        ? `-${coupon.percentOff}%`
                        : `-${formatPrice(coupon.amountOff ?? 0, locale)}`}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-ink-400">
                      {coupon.usedCount} {t.admin.couponUses}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
