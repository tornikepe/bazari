import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { countText, fill } from "@/lib/i18n";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { isOrderStatus, ORDER_STATUSES } from "@/lib/order-status";
import {
  BagIcon,
  ChevronRightIcon,
  HeartIcon,
  TagIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { CountUp } from "@/components/ui/CountUp";
import { AccountShell } from "@/components/account/AccountShell";
import { OrderFilterTabs } from "@/components/account/OrderFilterTabs";
import Image from "next/image";
import type { RawSearchParams } from "@/lib/filters";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt } from "@/components/ui/illustrations";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;

  // The layout redirects anonymous visitors, but this page renders in the same
  // pass — so it has to handle the null itself rather than assert it away.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");

  const RECENT = 20;

  /* The status being shown, taken from the URL so the view survives a reload
     and can be linked to. An unknown value is no filter rather than an error:
     it arrived from a query string, and a typo should not be a dead end. */
  const statusRaw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = isOrderStatus(statusRaw) ? statusRaw : null;

  const [orders, orderCount, byStatus, spending, favoriteCount, active] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true } },
        // The first three pictures, for the row to be recognised by —
        // an order number is a fact, a shoe is a memory.
        items: { take: 3, select: { id: true, image: true } },
      },
      take: RECENT,
    }),
    prisma.order.count({ where: { userId: user.id, ...(status ? { status } : {}) } }),
    /* Counted per status in one grouped query rather than one count per tab:
       five round trips to label five links is five times the work for the
       same page. */
    prisma.order.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true } }),
    /* Summed in the database over *every* order, not over the twenty rows
       drawn below. Counting the page rather than the account is how a figure
       ends up saying "106 orders, ₾2,125 spent" — two true numbers that
       describe different things. */
    prisma.order.aggregate({
      where: { userId: user.id, status: { not: "cancelled" } },
      _sum: { total: true },
    }),
    // The wishlist as the account holds it — the browser's copy is merged
    // into this on arrival, so the figure is the whole list, not one tab's.
    prisma.favorite.count({ where: { userId: user.id } }),
    // The newest order still on its way — the one thing a customer opens
    // this page to check — drawn at the top with where it has got to.
    prisma.order.findFirst({
      where: { userId: user.id, status: { in: ["pending", "confirmed", "shipped"] } },
      orderBy: { createdAt: "desc" },
      select: { number: true, status: true, total: true, createdAt: true, _count: { select: { items: true } } },
    }),
  ]);
  const STEPS = ["pending", "confirmed", "shipped", "delivered"] as const;
  const activeStep = active ? STEPS.indexOf(active.status as (typeof STEPS)[number]) : -1;

  const spent = spending._sum.total ?? 0;

  const countFor = (value: (typeof ORDER_STATUSES)[number]) =>
    byStatus.find((row) => row.status === value)?._count._all ?? 0;
  const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);

  /* Four figures, all of them counted rather than described. The wishlist
     is one of them and the way to the wishlist page — the overview used to
     keep a column of three doors beside the orders, and two of the three
     went where the tabs above already go. */
  const stats = [
    {
      icon: BagIcon,
      label: t.account.ordersCount,
      value: <CountUp value={orderCount} locale={locale} />,
    },
    {
      icon: TagIcon,
      label: t.account.spentTotal,
      value: <CountUp value={spent} kind="money" locale={locale} />,
    },
    {
      icon: HeartIcon,
      label: t.favorites.title,
      value: <CountUp value={favoriteCount} locale={locale} />,
      href: "/favorites",
    },
    {
      icon: TruckIcon,
      label: t.account.onTheWay,
      value: <CountUp value={countFor("pending") + countFor("confirmed") + countFor("shipped")} locale={locale} />,
    },
  ];

  return (
    <AccountShell user={user} t={t}>
      {/* -------------------------------- stats ------------------------------ */}
      {/* One strip divided by hairlines rather than four floating cards: the
          figures belong to each other, and the rule between them is the same
          one that separates everything else on this site. `gap-px` over a
          line-coloured background is what draws it — one border, not four. */}
      {/* `dt` and `dd` sit directly in each group: a `<dl>` allows nothing
          between a group's `div` and its terms, and the wrapper that used to
          hold them read as a list with no items. The icon lives inside the
          term instead, where decoration beside a label belongs. */}
      {active && (
        <Link
          href={`/order/${active.number}`}
          /* One row on a wide screen; on a phone the words above and the
             marks below, since a number, a date and four marks do not
             share 340px. */
          className="card mt-5 flex flex-col gap-4 card-pad transition-colors hover:border-ink-900 sm:flex-row sm:items-center sm:gap-6"
        >
          <span className="flex min-w-0 flex-1 items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-solid text-brand-on-solid">
              <TruckIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="eyebrow">{t.account.activeOrder}</span>
                <StatusBadge status={active.status} t={t} />
              </span>
              <span className="mt-1 block truncate">
                <span className="font-mono text-base font-bold text-ink-900">{active.number}</span>
                <span className="ml-2 text-xs text-ink-500">
                  {formatDate(active.createdAt)} ·{" "}
                  {countText(t.admin.productCountOne, t.admin.productCount, active._count.items)} ·{" "}
                  {formatPrice(active.total, locale)}
                </span>
              </span>
            </span>
          </span>
          <span className="flex items-center justify-between gap-4 pl-16 sm:justify-end sm:pl-0">
            {/* Four steps as four marks, the ones passed filled, the one it
                is on breathing — the timeline on the order page in a line. */}
            <span aria-hidden="true" className="flex items-center gap-1.5">
              {STEPS.map((step, index) => (
                <span
                  key={step}
                  className={`h-2 rounded-pill ${
                    index < activeStep
                      ? "w-4 bg-ink-300"
                      : index === activeStep
                        ? "progress-now w-8 bg-brand-600"
                        : "w-4 bg-ink-100"
                  }`}
                />
              ))}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-brand-600">
              {t.account.activeOrderOpen}
              <ChevronRightIcon size={14} />
            </span>
          </span>
        </Link>
      )}

      {/* The four figures on four rules, the way the home page sets its
          counts: the number in the serif, the label under it in small
          capitals, the icon beside the label. The wishlist's cell is the
          way to the wishlist. */}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-4">
        {stats.map((stat) => {
          const inner = (
            <>
              <dd className="display-md text-ink-900 tabular-nums">{stat.value}</dd>
              <dt className="eyebrow mt-1.5 flex items-center gap-1.5">
                <stat.icon size={13} className="shrink-0 text-brand-600" />
                <span className="truncate">{stat.label}</span>
                {stat.href && <ChevronRightIcon size={12} aria-hidden="true" className="shrink-0" />}
              </dt>
            </>
          );
          return stat.href ? (
            <div key={stat.label} className="border-t border-ink-900">
              <Link href={stat.href} className="group block pt-3 transition-colors hover:text-brand-600">
                {inner}
              </Link>
            </div>
          ) : (
            <div key={stat.label} className="border-t border-ink-900 pt-3">
              {inner}
            </div>
          );
        })}
      </dl>

      <div className="mt-10">
        {/* ------------------------------ orders ----------------------------- */}
        <div className="section-head">
          <div>
            <p className="eyebrow">{t.account.overview}</p>
            <h2 className="display-md mt-1 text-ink-900">{t.account.myOrders}</h2>
          </div>
          {/* Only when the list is not the whole story. A count beside a
              heading that shows every row is a number for its own sake. */}
          {orderCount > RECENT && (
            <p className="text-xs text-ink-500">{fill(t.account.showingLast, { count: RECENT })}</p>
          )}
        </div>

        <section id="orders" className="card mt-5 overflow-hidden scroll-mt-[calc(var(--header-h)+1rem)]">

          {/* Links rather than a `<select>`: the filter is part of the address,
              so a customer can bookmark "my delivered orders" and the back
              button behaves. Only the statuses this account has actually
              reached are offered — a tab reading "cancelled 0" invites a click
              that leads nowhere. */}
          {/* Only the statuses this account has actually reached are
              offered — a tab reading "cancelled 0" invites a click that
              leads nowhere. Switches in place: see `OrderFilterTabs`. */}
          {total > 0 && (
            <OrderFilterTabs
              current={status}
              options={[
                { value: null, count: total },
                ...ORDER_STATUSES.filter((value) => countFor(value) > 0).map((value) => ({
                  value,
                  count: countFor(value),
                })),
              ]}
            />
          )}

          {orders.length === 0 ? (
            <EmptyState
              art={<EmptyOrdersArt size={88} />}
              title={t.account.noOrders}
              text={t.account.noOrdersHint}
              titleAs="h3"
              action={
                <Link href="/catalog" className="btn btn-primary btn-md">
                  {t.catalog.title}
                </Link>
              }
            />
          ) : (
            <ul className="stagger divide-y divide-line">
              {orders.map((order) => (
                <li key={order.id}>
                  {/* A grid, not a wrapping row. Laid out with `flex-wrap` the
                      totals landed at a different x on every line — ₾104.00
                      above ₾96.50 above ₾194.00, none of them aligned — and a
                      column of money that does not line up cannot be scanned,
                      which is the only thing this list is for. */}
                  <Link
                    href={`/order/${order.number}`}
                    className="row-lean grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-5 py-3.5 hover:bg-ink-50 sm:grid-cols-[auto_1fr_6.5rem_auto_1rem] sm:gap-x-4"
                  >
                    {/* The first pictures, fanned: up to three, the ones
                        behind stepped to the right and dimmed. */}
                    <span className="order-fan" aria-hidden="true">
                      {order.items.map((item) => (
                        <span key={item.id}>
                          <Image src={item.image} alt="" fill sizes="44px" className="object-cover" />
                        </span>
                      ))}
                      {order._count.items > 3 && (
                        <span className="order-fan-more">+{order._count.items - 3}</span>
                      )}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-bold text-ink-900">
                        {order.number}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400 sm:truncate">
                        {formatDate(order.createdAt)} ·{" "}
                        {countText(
                          t.admin.productCountOne,
                          t.admin.productCount,
                          order._count.items,
                        )}
                      </p>
                    </div>

                    <p className="text-right text-sm font-bold text-ink-900 tabular-nums">
                      {formatPrice(order.total, locale)}
                    </p>

                    {/* Its own column from `sm` up so the badges form a line
                        rather than starting wherever the price happened to end.
                        Sized by its widest badge: at a fixed 7.5rem the Georgian
                        "confirmed" overran the column and covered the price. */}
                    <span className="col-span-3 justify-self-start pl-[3.75rem] sm:col-span-1 sm:justify-self-end sm:pl-0">
                      <StatusBadge status={order.status} t={t} />
                    </span>

                    <ChevronRightIcon
                      size={16}
                      aria-hidden="true"
                      className="row-chevron hidden shrink-0 text-ink-300 sm:block"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </AccountShell>
  );
}
