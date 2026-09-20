import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { getI18n } from "@/lib/locale";
import { formatDate, formatPrice, shopDayKey } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SalesChart } from "@/components/admin/SalesChart";
import {
  DEFAULT_RANGE,
  getDashboardMetrics,
  isRangeDays,
  parseDayKey,
  type MetricsWindow,
  type RangeDays,
} from "@/lib/analytics";
import { SalesTable } from "@/components/admin/SalesTable";
import { countText, fill } from "@/lib/i18n";
import type { RawSearchParams } from "@/lib/filters";
import { getCurrentUser } from "@/lib/auth";
import { initialsOf } from "@/components/account/initials";
import { CountUp } from "@/components/ui/CountUp";
import { Delta } from "@/components/ui/Delta";
import {
  AlertIcon,
  ArrowRightIcon,
  BagIcon,
  ChartIcon,
  ChevronRightIcon,
  PackageIcon,
  PlusIcon,
  SettingsIcon,
  TagIcon,
  TruckIcon,
} from "@/components/ui/icons";

/**
 * The first page of the dashboard: the shop at a glance.
 *
 * A band at the top says hello, what day it is, and the one thing that
 * wants doing — how many orders are waiting — with the window's revenue
 * beside it, counting up, and its shape as a line. Under it the four
 * figures, each against the window before it, each with its own line;
 * then the chart, whose bars grow out of the baseline; then the lists.
 * Everything arrives in order rather than at once, and nothing that
 * carries a reading depends on the motion to be read.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const user = await getCurrentUser();

  // The window comes from the URL so a particular view can be bookmarked and
  // shared. Validated rather than trusted — `?range=99999` would otherwise
  // build ninety-nine thousand buckets.
  const params = await searchParams;
  const one = (key: string) => (Array.isArray(params[key]) ? params[key]![0] : params[key]);
  const raw = Number(one("range"));
  // Two dates picked on the sales table win over the quick windows; a
  // half-picked or backwards pair falls back to the default.
  const from = parseDayKey(one("from"));
  const to = parseDayKey(one("to"));
  const picked = from && to && from <= to ? { from, to } : null;
  const range: RangeDays | null = picked ? null : isRangeDays(raw) ? raw : DEFAULT_RANGE;
  const window: MetricsWindow = picked ?? range ?? DEFAULT_RANGE;
  const showEmpty = one("empty") === "1";

  const today = shopDayKey(new Date());
  const [
    productCount,
    orderCount,
    pendingCount,
    todayCount,
    metrics,
    recentOrders,
    lowStock,
    topProducts,
    coupons,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { createdAt: { gte: new Date(`${today}T00:00:00+04:00`) } } }),

    getDashboardMetrics(window),

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

  const { revenue, profit, units, avgOrder, marginPct, daily, previous, days } = metrics;
  const needsRestock = lowStock.filter((product) => product.stock <= product.lowStockAt);
  const topMost = Math.max(1, ...topProducts.map((row) => row._sum.quantity ?? 0));

  // The day, in words, from the dictionary — the runtime's locale data
  // cannot be relied on for Georgian.
  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!, 12)).getUTCDay();
  const dateLine = `${t.common.weekdays[weekday]}, ${day} ${t.common.months[month! - 1]} ${year}`;
  const firstName = (user?.name ?? "").trim().split(/\s+/)[0] || user?.email || "";

  const stats = [
    {
      label: fill(t.admin.revenue30, { count: days }),
      value: revenue,
      kind: "money" as const,
      previous: previous.revenue,
      icon: TagIcon,
      tone: "bg-success-soft text-success",
      href: "/dashboard/orders",
    },
    {
      label: fill(t.admin.grossProfit, { count: days }),
      value: profit,
      kind: "money" as const,
      previous: previous.profit,
      hint: `${marginPct}% ${t.admin.margin}`,
      icon: BagIcon,
      tone: "bg-brand-100 text-brand-700",
      href: "/dashboard/analytics",
    },
    {
      label: t.admin.unitsSold,
      value: units,
      kind: "int" as const,
      previous: previous.units,
      hint: `${t.admin.avgOrder}: ${formatPrice(avgOrder, locale)}`,
      icon: PackageIcon,
      tone: "bg-info-soft text-info",
      href: "/dashboard/products",
    },
    {
      label: t.admin.pendingOrders,
      value: pendingCount,
      kind: "int" as const,
      // "182 orders · 40 products", not "182 · 40" — two numbers with no
      // nouns are two numbers.
      hint: `${countText(t.admin.orderCountOne, t.admin.orderCount, orderCount)} · ${countText(
        t.admin.productCountOne,
        t.admin.productCount,
        productCount,
      )}`,
      icon: TruckIcon,
      tone: "bg-warning-soft text-warning",
      href: "/dashboard/orders?status=pending",
    },
  ];

  const quick = [
    { href: "/dashboard/products/new", label: t.admin.quickNewProduct, icon: PlusIcon },
    { href: "/dashboard/orders", label: t.admin.orders, icon: BagIcon },
    { href: "/dashboard/analytics", label: t.admin.analytics, icon: ChartIcon },
    { href: "/dashboard/settings", label: t.admin.settings, icon: SettingsIcon },
  ];

  return (
    <div className="stagger mx-auto max-w-6xl">
      <ReadOnlyNotice />

      {/* -------------------------------- band ------------------------------ */}
      <section className="hero-band shine-once">
        <span aria-hidden="true" className="hero-grid" />
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="min-w-0">
            <p className="hero-muted text-xs font-bold tracking-wider uppercase">{dateLine}</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {fill(t.admin.greeting, { name: firstName })}
            </h1>
            <p className="hero-muted mt-2 text-sm">
              {pendingCount > 0 ? (
                <Link
                  href="/dashboard/orders?status=pending"
                  className="inline-flex items-center gap-1.5 font-semibold text-panel-fg underline decoration-panel-muted underline-offset-4 transition-colors hover:decoration-panel-fg"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-warning opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-pill bg-warning" />
                  </span>
                  {countText(t.admin.heroPendingOne, t.admin.heroPending, pendingCount)}
                </Link>
              ) : (
                t.admin.heroAllClear
              )}
              {todayCount > 0 && (
                <span className="ml-3">
                  · {t.admin.ordersToday}:{" "}
                  <span className="font-semibold text-panel-fg tabular-nums">{todayCount}</span>
                </span>
              )}
            </p>

            <ul className="mt-5 flex flex-wrap gap-2">
              {quick.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href}
                    className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-white/15 bg-white/10 px-3.5 text-xs font-semibold text-panel-fg backdrop-blur transition-colors hover:border-white/30 hover:bg-white/20"
                  >
                    <action.icon size={14} />
                    {action.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* The window's revenue, large, counting up, and how it moved
              against the window before — said in words, on the band's own
              muted tone rather than green or red on the dark. */}
          <div className="min-w-0 lg:max-w-xs lg:text-right">
            <p className="hero-muted text-xs">
              {picked
                ? fill(t.admin.heroRevenueRange, {
                    from: formatDate(`${picked.from}T12:00:00+04:00`),
                    to: formatDate(`${picked.to}T12:00:00+04:00`),
                  })
                : fill(t.admin.heroRevenue, { count: days })}
            </p>
            <p className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
              <CountUp value={revenue} kind="money" locale={locale} duration={1200} />
            </p>
            <p className="hero-muted mt-1 text-xs [&_span]:text-panel-fg">
              <Delta current={revenue} previous={previous.revenue} days={days} t={t} />
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------- stats ------------------------------ */}
      <div className="stagger mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="card hover-lift flex items-start gap-3.5 card-pad-tight"
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-control ${stat.tone}`}
            >
              <stat.icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-500">{stat.label}</p>
              <p className="truncate text-xl font-extrabold tracking-tight text-ink-900">
                <CountUp value={stat.value} kind={stat.kind} locale={locale} />
              </p>
              {stat.hint && <p className="mt-0.5 truncate text-xs text-ink-400">{stat.hint}</p>}
              {/* How it moved, in a sentence: "12% more than the 30 days
                  before". */}
              {"previous" in stat && stat.previous !== undefined && (
                <p className="mt-1 leading-snug">
                  <Delta current={stat.value} previous={stat.previous} days={days} t={t} />
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* ------------------------------- chart ------------------------------ */}
      <SalesTable
        daily={daily}
        from={metrics.from}
        to={metrics.to}
        range={range}
        showEmpty={showEmpty}
        locale={locale}
        t={t}
      />

      <section className="card mt-4 card-pad">
        <div>
          <h2 className="text-sm font-bold text-ink-900">
            {fill(t.admin.salesChart, { count: days })}
          </h2>
          <p className="mt-0.5 text-xs text-ink-500">{t.admin.chartHint}</p>
        </div>

        <SalesChart
          data={daily}
          locale={locale}
          t={t}
          hrefFor={(day) => `/dashboard/orders?day=${day}`}
        />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* --------------------------- recent orders ------------------------ */}
        <section className="card overflow-hidden">
          <div className="card-head flex items-center justify-between gap-3">
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
            <ul className="stagger divide-y divide-line">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="row-lean flex items-center gap-3 px-5 py-3 hover:bg-ink-50"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-ink-100 text-xs font-extrabold text-ink-600"
                    >
                      {initialsOf(order.customerName, order.email || order.phone)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-bold whitespace-nowrap text-ink-900">
                        {order.number}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {order.customerName} · {order.city}
                      </p>
                    </div>

                    <div className="hidden text-right sm:block">
                      <p className="text-xs text-ink-400">{formatDate(order.createdAt)}</p>
                      <p className="text-xs text-ink-400">
                        {countText(t.admin.productCountOne, t.admin.productCount, order._count.items)}
                      </p>
                    </div>

                    {/* On a phone the total sits over the status rather than
                        beside it: a number, a Georgian status and a Georgian
                        name do not share 340 pixels. */}
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <p className="text-sm font-bold whitespace-nowrap text-ink-900 sm:w-20 sm:text-right">
                        {formatPrice(order.total, locale)}
                      </p>
                      <StatusBadge status={order.status} t={t} />
                    </div>
                    <ChevronRightIcon
                      size={15}
                      aria-hidden="true"
                      className="row-chevron hidden shrink-0 text-ink-300 sm:block"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="stagger flex flex-col gap-4">
          {/* --------------------------- top products ----------------------- */}
          <section className="card overflow-hidden">
            <div className="card-head">
              <h2 className="text-sm font-bold text-ink-900">{t.admin.topProducts}</h2>
              <p className="text-xs text-ink-400">{t.admin.topProductsHint}</p>
            </div>

            {topProducts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">{t.admin.noSales}</p>
            ) : (
              <ol className="stagger flex flex-col gap-3 px-5 py-4">
                {topProducts.map((row, index) => {
                  const sold = row._sum.quantity ?? 0;
                  return (
                    <li key={row.productId ?? row.nameKa}>
                      <div className="flex items-center gap-3">
                        <span className="w-4 shrink-0 text-xs font-bold text-ink-400 tabular-nums">
                          {index + 1}
                        </span>
                        <span className="line-clamp-1 flex-1 text-xs font-semibold text-ink-800">
                          {locale === "ka" ? row.nameKa : row.nameEn}
                        </span>
                        <span className="shrink-0 text-xs font-bold text-ink-900 tabular-nums">
                          {sold} {t.admin.soldUnits}
                        </span>
                      </div>
                      {/* The bar is the product's share of the leader: the
                          list says who sold most, the bars say by how much. */}
                      <span
                        aria-hidden="true"
                        className="mt-1.5 ml-7 block h-1.5 overflow-hidden rounded-pill bg-ink-100"
                      >
                        <span
                          className="fill-bar block h-full rounded-pill bg-brand-500"
                          style={{ width: `${Math.max(4, (sold / topMost) * 100)}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ----------------------------- low stock ------------------------ */}
          <section className="card overflow-hidden">
            <div className="card-head flex items-center gap-2">
              <AlertIcon size={15} className="text-warning" />
              <h2 className="text-sm font-bold text-ink-900">{t.admin.lowStockTitle}</h2>
            </div>

            {needsRestock.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-400">{t.admin.lowStockEmpty}</p>
            ) : (
              <ul className="stagger divide-y divide-line">
                {needsRestock.map((product) => {
                  const threshold = Math.max(1, product.lowStockAt);
                  const share = Math.min(1, product.stock / threshold);
                  return (
                    <li key={product.id}>
                      <Link
                        href={`/dashboard/products/${product.id}`}
                        className="row-lean flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 block text-xs font-semibold text-ink-800">
                            {locale === "ka" ? product.nameKa : product.nameEn}
                          </span>
                          {/* What is left against the level the shop set as
                              "low": the bar drains as the shelf does. */}
                          <span
                            aria-hidden="true"
                            className="mt-1.5 block h-1 w-full max-w-40 overflow-hidden rounded-pill bg-ink-100"
                          >
                            <span
                              className={`fill-bar block h-full rounded-pill ${
                                product.stock === 0 ? "bg-danger" : "bg-warning"
                              }`}
                              style={{ width: `${Math.max(3, share * 100)}%` }}
                            />
                          </span>
                        </span>
                        <span
                          className={`badge shrink-0 tabular-nums ${
                            product.stock === 0
                              ? "bg-danger-soft text-danger"
                              : "bg-warning-soft text-warning"
                          }`}
                          title={fill(t.admin.stockOf, { stock: product.stock, threshold })}
                        >
                          {product.stock}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ------------------------------ coupons ------------------------- */}
          {coupons.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="card-head text-sm font-bold text-ink-900">
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
                    <span className="ml-auto shrink-0 text-xs text-ink-400 tabular-nums">
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
