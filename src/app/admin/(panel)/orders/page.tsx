import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDateTime, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { isOrderStatus, ORDER_STATUSES } from "@/lib/order-status";
import type { RawSearchParams } from "@/lib/filters";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const raw = (Array.isArray(params.status) ? params.status[0] : params.status)?.trim() ?? "";
  const status = isOrderStatus(raw) ? raw : null;

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countFor = (value: string) =>
    counts.find((entry) => entry.status === value)?._count._all ?? 0;
  const totalCount = counts.reduce((sum, entry) => sum + entry._count._all, 0);

  const tabs: { value: string; label: string; count: number }[] = [
    { value: "", label: t.admin.all, count: totalCount },
    ...ORDER_STATUSES.map((value) => ({
      value,
      label: t.status[value],
      count: countFor(value),
    })),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
        {t.admin.orders}
        <span className="ml-2 text-sm font-medium text-ink-400">{totalCount}</span>
      </h1>

      {/* status tabs */}
      <div className="mt-4 flex gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <Link
            key={tab.value || "all"}
            href={tab.value ? `/admin/orders?status=${tab.value}` : "/admin/orders"}
            aria-current={status === tab.value ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium transition-colors ${
              status === tab.value
                ? "bg-ink-900 text-white"
                : "border border-line bg-surface text-ink-600 hover:bg-ink-50"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs ${
                status === tab.value ? "text-ink-300" : "text-ink-400"
              }`}
            >
              {tab.count}
            </span>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="card mt-5 px-6 py-16 text-center">
          <p className="text-sm text-ink-500">{t.admin.noOrders}</p>
        </div>
      ) : (
        <div className="card mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left">
              <thead className="border-b border-line bg-ink-50 text-xs font-bold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">{t.admin.orderNumber}</th>
                  <th className="px-4 py-2.5">{t.admin.customer}</th>
                  <th className="px-4 py-2.5">{t.admin.date}</th>
                  <th className="px-4 py-2.5 text-right">{t.admin.total}</th>
                  <th className="px-4 py-2.5">{t.admin.status}</th>
                  <th className="px-4 py-2.5">{t.admin.updateStatus}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-ink-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-xs font-bold text-ink-900 hover:text-brand-600"
                      >
                        {order.number}
                      </Link>
                      <p className="text-xs text-ink-400">
                        {order._count.items} {t.admin.productCount}
                      </p>
                    </td>

                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium text-ink-800">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-ink-400">
                        {order.phone} · {order.city}
                      </p>
                    </td>

                    <td className="px-4 py-2.5 text-xs text-ink-500">
                      {formatDateTime(order.createdAt)}
                    </td>

                    <td className="px-4 py-2.5 text-right text-xs font-bold text-ink-900">
                      {formatPrice(order.total, locale)}
                    </td>

                    <td className="px-4 py-2.5">
                      <StatusBadge status={order.status} t={t} />
                    </td>

                    <td className="px-4 py-2.5">
                      <OrderStatusSelect id={order.id} status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
