import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  AlertIcon,
  ArrowRightIcon,
  BagIcon,
  PackageIcon,
  TagIcon,
  TruckIcon,
} from "@/components/ui/icons";

const LOW_STOCK_THRESHOLD = 10;

export default async function AdminDashboardPage() {
  const { locale, t } = await getI18n();

  const [productCount, orderCount, pendingCount, revenue, recentOrders, lowStock] =
    await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: "pending" } }),
      // Cancelled orders never brought money in, so they're excluded.
      prisma.order.aggregate({
        where: { NOT: { status: "cancelled" } },
        _sum: { total: true },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { _count: { select: { items: true } } },
      }),
      prisma.product.findMany({
        where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } },
        orderBy: { stock: "asc" },
        take: 6,
        select: { id: true, nameKa: true, nameEn: true, stock: true, slug: true },
      }),
    ]);

  const stats = [
    {
      label: t.admin.totalProducts,
      value: String(productCount),
      icon: PackageIcon,
      href: "/admin/products",
      tone: "bg-info-soft text-info",
    },
    {
      label: t.admin.totalOrders,
      value: String(orderCount),
      icon: BagIcon,
      href: "/admin/orders",
      tone: "bg-brand-100 text-brand-700",
    },
    {
      label: t.admin.pendingOrders,
      value: String(pendingCount),
      icon: TruckIcon,
      href: "/admin/orders?status=pending",
      tone: "bg-warning-soft text-warning",
    },
    {
      label: t.admin.revenue,
      value: formatPrice(revenue._sum.total ?? 0, locale),
      icon: TagIcon,
      href: "/admin/orders",
      tone: "bg-success-soft text-success",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
        {t.admin.overview}
      </h1>

      {/* ------------------------------- stats ------------------------------ */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="card flex items-center gap-3.5 p-4 transition-shadow hover:shadow-lift"
          >
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-control ${stat.tone}`}>
              <stat.icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-ink-500">{stat.label}</p>
              <p className="truncate text-lg font-extrabold tracking-tight text-ink-900">
                {stat.value}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* --------------------------- recent orders ------------------------ */}
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.recentOrders}</h2>
            <Link
              href="/admin/orders"
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
                    href={`/admin/orders/${order.id}`}
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

        {/* ----------------------------- low stock -------------------------- */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
            <AlertIcon size={15} className="text-warning" />
            <h2 className="text-sm font-bold text-ink-900">{t.admin.lowStockTitle}</h2>
          </div>

          {lowStock.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-400">{t.admin.lowStockEmpty}</p>
          ) : (
            <ul className="divide-y divide-line">
              {lowStock.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50"
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
      </div>
    </div>
  );
}
