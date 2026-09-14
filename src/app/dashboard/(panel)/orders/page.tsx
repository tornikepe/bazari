import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { getI18n } from "@/lib/locale";
import {
  formatDate,
  formatDateTime,
  formatPrice,
  shopDayRange,
} from "@/lib/format";
import { countText, fill } from "@/lib/i18n";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { AdminToolbar } from "@/components/admin/AdminToolbar";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { isOrderStatus, ORDER_STATUSES } from "@/lib/order-status";
import type { Prisma } from "@/generated/prisma/client";
import type { RawSearchParams } from "@/lib/filters";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt, NoResultsArt } from "@/components/ui/illustrations";
import { CloseIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/layout/PageHeader";
import { BulkOrders } from "@/components/admin/BulkOrders";
import { WriteOnly } from "@/components/admin/StaffRoleProvider";
import { SavedViews } from "@/components/admin/SavedViews";
import { getSavedViews } from "@/lib/saved-views-store";

const SORTS = ["newest", "oldest", "total-desc", "total-asc"] as const;

/**
 * `id` as the last key, always.
 *
 * Two orders placed in the same second — which the seed produces by the dozen
 * — otherwise come back in whatever order the planner felt like, and one row
 * can appear on page one and again on page two of the same listing.
 */
function buildOrderBy(sort: string): Prisma.OrderOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "total-desc":
      return [{ total: "desc" }, { id: "asc" }];
    case "total-asc":
      return [{ total: "asc" }, { id: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

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
  const sortRaw = one(params.sort);
  const sort = (SORTS as readonly string[]).includes(sortRaw)
    ? sortRaw
    : "newest";
  const pageRaw = Number(one(params.page));
  const requestedPage =
    Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  // One shop day, as the overview's chart hands it over when a bar is
  // pressed: the rows that bar was drawn from, and nothing from the hours
  // either side of it that UTC midnight would let in.
  const dayRaw = one(params.day);
  const dayRange = dayRaw ? shopDayRange(dayRaw) : null;
  const day = dayRange ? dayRaw : "";

  const and: Prisma.OrderWhereInput[] = [];
  if (status) and.push({ status });
  if (dayRange)
    and.push({ createdAt: { gte: dayRange.start, lt: dayRange.end } });
  if (query) {
    const contains = { contains: query, mode: "insensitive" } as const;
    and.push({
      OR: [
        { number: contains },
        { customerName: contains },
        { phone: contains },
        { city: contains },
      ],
    });
  }
  const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {};

  const [total, counts, dayTotals] = await Promise.all([
    prisma.order.count({ where }),
    // The tabs count within the day when one is chosen, so "confirmed 3"
    // means three of that day's orders and not three of all time.
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: dayRange
        ? { createdAt: { gte: dayRange.start, lt: dayRange.end } }
        : undefined,
    }),
    // What the day came to, said above its list: the count and the money,
    // so the strip agrees with the bar that opened it.
    dayRange
      ? prisma.order.aggregate({
          where: {
            createdAt: { gte: dayRange.start, lt: dayRange.end },
            status: { not: "cancelled" },
          },
          _count: { _all: true },
          _sum: { total: true },
        })
      : null,
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const orders = await prisma.order.findMany({
    where,
    orderBy: buildOrderBy(sort),
    include: {
      _count: { select: { items: true } },
      // The first few pictures, so a row can be told from the next by what
      // was bought and not only by its number. Four is enough to show three
      // and say how many more.
      items: {
        select: { id: true, image: true, nameKa: true, nameEn: true },
        take: 4,
      },
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

  /** This listing's URL with some of its parameters changed. */
  const listHref = (overrides: { status?: string; day?: string }) => {
    const next = { day, status: status ?? "", q: query, ...overrides };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(next))
      if (value) search.set(key, value);
    const qs = search.toString();
    return qs ? `/dashboard/orders?${qs}` : "/dashboard/orders";
  };
  const tabHref = (value: string) => listHref({ status: value });

  const views = await getSavedViews("orders");

  return (
    <div className="mx-auto max-w-6xl">
      <ReadOnlyNotice />

      <PageHeader scale="panel" title={t.admin.orders} count={allCount} />

      {/* The day the chart opened, with what it came to and a way out of it. */}
      {day && dayTotals && (
        <div className="card mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 card-pad-tight">
          <p className="text-sm font-bold text-ink-900">
            {fill(t.admin.dayFilter, { date: formatDate(dayRange!.start) })}
          </p>
          <p className="text-xs text-ink-500">
            {fill(t.admin.dayFilterSummary, {
              count: dayTotals._count._all,
              total: formatPrice(dayTotals._sum.total ?? 0, locale),
            })}
          </p>
          <Link
            href={listHref({ day: "" })}
            className="btn btn-ghost btn-sm ml-auto -mr-2 gap-1.5 text-xs"
          >
            <CloseIcon size={14} />
            {t.admin.dayFilterClear}
          </Link>
        </div>
      )}

      {/* status tabs */}
      <div className="mt-4 -mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        {tabs.map((tab) => (
          <Link
            key={tab.value || "all"}
            href={tabHref(tab.value)}
            aria-current={(status ?? "") === tab.value ? "page" : undefined}
            /* 44px on a phone. These were 30px tall, which is a comfortable
               size for a mouse and a poor one for a thumb — and this row is
               the primary way an order list is narrowed on a small screen. */
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-sm font-medium transition-colors sm:min-h-9 ${
              (status ?? "") === tab.value
                ? "bg-panel text-panel-fg"
                : "border border-line bg-surface text-ink-600 hover:bg-ink-50"
            }`}
          >
            {tab.label}
            <span
              className={`text-xs ${
                (status ?? "") === tab.value
                  ? "text-panel-muted"
                  : "text-ink-400"
              }`}
            >
              {tab.count}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3">
        <SavedViews className="mb-3" page="orders" views={views} />

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
                ...ORDER_STATUSES.map((value) => ({
                  value,
                  label: t.status[value],
                })),
              ],
            },
            {
              name: "sort",
              label: t.admin.sortBy,
              /* Empty means the default, so "newest" is not repeated in the
                 URL of every listing that never changed it. */
              value: sort === "newest" ? "" : sort,
              options: [
                { value: "", label: t.admin.sortNewest },
                { value: "oldest", label: t.admin.sortOldest },
                { value: "total-desc", label: t.admin.sortTotalDesc },
                { value: "total-asc", label: t.admin.sortTotalAsc },
              ],
            },
          ]}
          hasActive={Boolean(query || status || sort !== "newest" || day)}
          keep={{ day }}
        />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          className="card mt-4"
          art={
            query || status || day ? (
              <NoResultsArt size={88} />
            ) : (
              <EmptyOrdersArt size={88} />
            )
          }
          title={query || status || day ? t.admin.noMatches : t.admin.noOrders}
          text={
            query || status || day
              ? t.admin.noMatchesHint
              : t.admin.noOrdersHint
          }
          titleAs="p"
          action={
            (query || status || day) && (
              <Link href="/dashboard/orders" className="btn btn-outline btn-md">
                {t.admin.resetFilters}
              </Link>
            )
          }
        />
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-400">
            {fill(t.admin.showingCount, {
              from: (page - 1) * PAGE_SIZE + 1,
              to: (page - 1) * PAGE_SIZE + orders.length,
              total,
            })}
          </p>

          <BulkOrders ids={orders.map((order) => order.id)}>
            {/* Cards below lg — an order row has too many columns for a phone. */}
            <ul className="mt-3 flex flex-col gap-2 lg:hidden">
              {orders.map((order) => (
                <li key={order.id} className="card card-pad-tight">
                  <div className="flex items-start justify-between gap-3">
                    <WriteOnly>
                      <label className="flex shrink-0 items-start pt-0.5">
                        <span className="sr-only">
                          {fill(t.admin.bulkSelectOrder, {
                            number: order.number,
                          })}
                        </span>
                        <input
                          type="checkbox"
                          name="order-id"
                          value={order.id}
                          className="h-4 w-4 accent-brand-600"
                        />
                      </label>
                    </WriteOnly>

                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="font-mono text-sm font-bold whitespace-nowrap text-ink-900"
                      >
                        {order.number}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {order.customerName} ·{" "}
                        {order.deliveryMethod === "pickup"
                          ? t.checkout.deliveryPickup
                          : order.city}
                      </p>
                      <p className="truncate text-xs text-ink-400">
                        {order.phone}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-ink-900">
                        {formatPrice(order.total, locale)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          order.paymentStatus === "paid"
                            ? "text-success"
                            : order.paymentStatus === "refunded"
                              ? "text-ink-400"
                              : "text-warning"
                        }`}
                      >
                        {t.payment[order.paymentStatus]}
                      </p>
                      <p className="text-xs text-ink-400">
                        {countText(
                          t.admin.productCountOne,
                          t.admin.productCount,
                          order._count.items,
                        )}
                      </p>
                    </div>
                  </div>

                  <OrderThumbs
                    className="mt-3"
                    items={order.items}
                    count={order._count.items}
                    locale={locale}
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <StatusBadge status={order.status} t={t} />
                    <OrderStatusSelect id={order.id} status={order.status} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Table from lg upwards. Scrolls sideways inside the card when the
              window is narrower than its columns — with the rail beside it,
              a 1280px window is — rather than clipping its last column. */}
            <div className="card mt-3 hidden overflow-x-auto lg:block">
              <table className="table">
                <thead>
                  <tr>
                    {/* No header checkbox: select-all lives above the table so it
                      exists at every width, and a column heading made of one
                      control reads as a column of data. */}
                    <WriteOnly>
                      <th className="w-10">
                        <span className="sr-only">{t.admin.bulkSelectAll}</span>
                      </th>
                    </WriteOnly>
                    <th>{t.admin.orderNumber}</th>
                    <th>
                      <span className="sr-only">{t.admin.items}</span>
                    </th>
                    <th>{t.admin.customer}</th>
                    <th>{t.admin.placedAt}</th>
                    <th>{t.admin.statusChangedAt}</th>
                    <th className="figures">{t.admin.total}</th>
                    <th>{t.admin.status}</th>
                    <th>{t.admin.updateStatus}</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <WriteOnly>
                        <td>
                          <label className="flex items-center">
                            <span className="sr-only">
                              {fill(t.admin.bulkSelectOrder, {
                                number: order.number,
                              })}
                            </span>
                            <input
                              type="checkbox"
                              name="order-id"
                              value={order.id}
                              className="h-4 w-4 accent-brand-600"
                            />
                          </label>
                        </td>
                      </WriteOnly>

                      <td>
                        {/* One token. The column is narrow and the number is
                          mono; let wrap, it broke as "BZ-" over "8D6C2EAB",
                          which reads as two things. */}
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="font-mono text-xs font-bold whitespace-nowrap text-ink-900 hover:text-brand-600"
                        >
                          {order.number}
                        </Link>
                        <p className="text-xs text-ink-400">
                          {countText(
                            t.admin.productCountOne,
                            t.admin.productCount,
                            order._count.items,
                          )}
                        </p>
                      </td>

                      <td>
                        <OrderThumbs
                          items={order.items}
                          count={order._count.items}
                          locale={locale}
                        />
                      </td>

                      <td>
                        <p className="text-sm font-medium text-ink-800">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-ink-400">
                          {order.phone} ·{" "}
                          {order.deliveryMethod === "pickup"
                            ? t.checkout.deliveryPickup
                            : order.city}
                        </p>
                      </td>

                      <td className="text-xs text-ink-500 tabular-nums">
                        {formatDateTime(order.createdAt)}
                      </td>

                      {/* Blank rather than repeating the placed time when the
                        order has not moved yet — an em dash says "nothing has
                        happened", a duplicated timestamp says "it was
                        confirmed the second it arrived", which is not true. */}
                      <td className="text-xs text-ink-500 tabular-nums">
                        {order.events[0]
                          ? formatDateTime(order.events[0].createdAt)
                          : "—"}
                      </td>

                      <td className="figures text-sm font-bold text-ink-900">
                        {formatPrice(order.total, locale)}
                        {/* Whether the money is in, under the money: the one
                          thing about an order the list did not say, and the
                          first thing asked about a card order. */}
                        <p
                          className={`text-xs font-semibold ${
                            order.paymentStatus === "paid"
                              ? "text-success"
                              : order.paymentStatus === "refunded"
                                ? "text-ink-400"
                                : "text-warning"
                          }`}
                        >
                          {t.payment[order.paymentStatus]}
                        </p>
                      </td>

                      <td>
                        <StatusBadge status={order.status} t={t} />
                      </td>

                      <td>
                        <OrderStatusSelect
                          id={order.id}
                          status={order.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BulkOrders>

          <AdminPagination
            basePath="/dashboard/orders"
            params={{ q: query, status: status ?? "", day }}
            page={page}
            pageCount={pageCount}
            labels={{
              previous: t.common.previous,
              next: t.common.next,
              page: t.common.page,
            }}
          />
        </>
      )}
    </div>
  );
}

/**
 * What was bought, as pictures: up to three, and the number left over.
 * The same strip in the phone card and the desktop row, so the two show
 * the same order the same way.
 */
function OrderThumbs({
  items,
  count,
  locale,
  className = "",
}: {
  items: { id: string; image: string; nameKa: string; nameEn: string }[];
  count: number;
  locale: string;
  className?: string;
}) {
  const shown = items.slice(0, 3);
  const more = count - shown.length;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {shown.map((item) => (
        <span
          key={item.id}
          title={locale === "ka" ? item.nameKa : item.nameEn}
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-control border border-line bg-ink-50"
        >
          <Image
            src={item.image}
            alt=""
            fill
            sizes="40px"
            className="object-cover"
          />
        </span>
      ))}
      {more > 0 && (
        <span className="grid h-10 min-w-10 shrink-0 place-items-center rounded-control border border-line bg-ink-50 px-1.5 text-xs font-bold text-ink-600 tabular-nums">
          +{more}
        </span>
      )}
    </div>
  );
}
