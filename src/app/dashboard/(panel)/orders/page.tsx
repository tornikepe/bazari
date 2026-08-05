import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { getI18n } from "@/lib/locale";
import { formatDateTime, formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { isOrderStatus, ORDER_STATUSES } from "@/lib/order-status";
import { BagIcon } from "@/components/ui/icons";
import type { Prisma } from "@/generated/prisma/client";
import type { RawSearchParams } from "@/lib/filters";

const PAGE_SIZE = 20;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const statusRaw = one(params.status);
  const status = isOrderStatus(statusRaw) ? statusRaw : null;
  const query = one(params.q);
  const pageRaw = Number(one(params.page));
  const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const and: Prisma.OrderWhereInput[] = [];
  if (status) and.push({ status });
  if (query) {
    const contains = { contains: query, mode: "insensitive" } as const;
    and.push({
      OR: [{ number: contains }, { customerName: contains }, { phone: contains }, { city: contains }],
    });
  }
  const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {};

  const [total, counts] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { items: true } },
      // Only the newest event per order: the column shows when the status last
      // moved, and the rest of the history belongs on the detail page.
      events: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const countFor = (value: string) =>
    counts.find((entry) => entry.status === value)?._count._all ?? 0;
  const allCount = counts.reduce((sum, entry) => sum + entry._count._all, 0);

  const tabs: { value: string; label: string; count: number }[] = [
    { value: "", label: t.admin.all, count: allCount },
    ...ORDER_STATUSES.map((value) => ({
      value,
      label: t.status[value],
      count: countFor(value),
    })),
  ];

  const tabHref = (value: string) => {
    const search = new URLSearchParams();
    if (value) search.set("status", value);
    if (query) search.set("q", query);
    const qs = search.toString();
    return qs ? `/dashboard/orders?${qs}` : "/dashboard/orders";
  };

  return (
    <div className="mx-auto max-w-6xl">
      <ReadOnlyNotice />

      <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
        {t.admin.orders}
        <span className="ml-2 text-sm font-medium text-ink-400">{allCount}</span>
      </h1>

      {/* status tabs */}
      <div className="mt-4 -mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <Link
            key={tab.value || "all"}
            href={tabHref(tab.value)}
            aria-current={(status ?? "") === tab.value ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition-colors ${
              (status ?? "") === tab.value
                ? "bg-panel text-panel-fg"
                : "border border-line bg-surface text-ink-600 hover:bg-ink-50"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs ${
                (status ?? "") === tab.value ? "text-ink-300" : "text-ink-400"
              }`}
            >
              {tab.count}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3">
        <AdminToolbar
          basePath="/dashboard/orders"
          search={query}
          searchPlaceholder={t.admin.searchOrders}
          filters={[
            {
              name: "status",
              label: t.admin.status,
              value: status ?? "",
              options: [
                { value: "", label: t.admin.all },
                ...ORDER_STATUSES.map((value) => ({ value, label: t.status[value] })),
              ],
            },
          ]}
          hasActive={Boolean(query || status)}
        />
      </div>

      {orders.length === 0 ? (
        <div className="card mt-4 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-pill bg-ink-100 text-ink-400">
            <BagIcon size={26} />
          </span>
          <p className="text-sm text-ink-500">
            {query || status ? t.admin.noMatches : t.admin.noOrders}
          </p>
        </div>
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-400">
            {fill(t.admin.showingCount, {
              from: (page - 1) * PAGE_SIZE + 1,
              to: (page - 1) * PAGE_SIZE + orders.length,
              total,
            })}
          </p>

          {/* Cards below lg — an order row has too many columns for a phone. */}
          <ul className="mt-3 flex flex-col gap-2 lg:hidden">
            {orders.map((order) => (
              <li key={order.id} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="font-mono text-sm font-bold text-ink-900"
                    >
                      {order.number}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {order.customerName} · {order.city}
                    </p>
                    <p className="truncate text-xs text-ink-400">{order.phone}</p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-ink-900">
                      {formatPrice(order.total, locale)}
                    </p>
                    <p className="text-xs text-ink-400">
                      {order._count.items} {t.admin.productCount}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <StatusBadge status={order.status} t={t} />
                  <OrderStatusSelect id={order.id} status={order.status} />
                </div>
              </li>
            ))}
          </ul>

          {/* Table from lg upwards */}
          <div className="card mt-3 hidden overflow-hidden lg:block">
            <table className="w-full text-left">
              <thead className="border-b border-line bg-ink-50 text-xs font-bold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">{t.admin.orderNumber}</th>
                  <th className="px-4 py-2.5">{t.admin.customer}</th>
                  <th className="px-4 py-2.5">{t.admin.placedAt}</th>
                  <th className="px-4 py-2.5">{t.admin.statusChangedAt}</th>
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
                        href={`/dashboard/orders/${order.id}`}
                        className="font-mono text-xs font-bold text-ink-900 hover:text-brand-600"
                      >
                        {order.number}
                      </Link>
                      <p className="text-xs text-ink-400">
                        {order._count.items} {t.admin.productCount}
                      </p>
                    </td>

                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium text-ink-800">{order.customerName}</p>
                      <p className="text-xs text-ink-400">
                        {order.phone} · {order.city}
                      </p>
                    </td>

                    <td className="px-4 py-2.5 text-xs text-ink-500 tabular-nums">
                      {formatDateTime(order.createdAt)}
                    </td>

                    {/* Blank rather than repeating the placed time when the
                        order has not moved yet — an em dash says "nothing has
                        happened", a duplicated timestamp says "it was
                        confirmed the second it arrived", which is not true. */}
                    <td className="px-4 py-2.5 text-xs text-ink-500 tabular-nums">
                      {order.events[0] ? formatDateTime(order.events[0].createdAt) : "—"}
                    </td>

                    <td className="px-4 py-2.5 text-right text-sm font-bold text-ink-900">
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

          <AdminPagination
            basePath="/dashboard/orders"
            params={{ q: query, status: status ?? "" }}
            page={page}
            pageCount={pageCount}
            labels={{ previous: t.common.previous, next: t.common.next, page: t.common.page }}
          />
        </>
      )}
    </div>
  );
}
