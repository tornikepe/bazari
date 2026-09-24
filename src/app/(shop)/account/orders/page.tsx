import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/locale";
import { countText, fill } from "@/lib/i18n";
import { formatDate, formatPrice } from "@/lib/format";
import { StatusBadge, STATUS_STYLES } from "@/components/ui/StatusBadge";
import { isOrderStatus, ORDER_STATUSES } from "@/lib/order-status";
import {
  BagIcon,
  ChevronRightIcon,
  TagIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { CountUp } from "@/components/ui/CountUp";
import { AccountShell, AccountCardHead } from "@/components/account/AccountShell";
import { OrderFilterTabs } from "@/components/account/OrderFilterTabs";
import Image from "next/image";
import type { RawSearchParams } from "@/lib/filters";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt } from "@/components/ui/illustrations";

/** The status as a dot in its own colour, before the word. */
function StatusDot({ status }: { status: string }) {
  const tone = STATUS_STYLES[status]?.split(" ").pop() ?? "text-ink-400";
  return <span aria-hidden="true" className={`order-row-dot ${tone}`} />;
}

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;

  // The layout redirects anonymous visitors, but this page renders in the same
  // pass — so it has to handle the null itself rather than assert it away.
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/orders");

  const RECENT = 20;

  /* The status being shown, taken from the URL so the view survives a reload
     and can be linked to. An unknown value is no filter rather than an error:
     it arrived from a query string, and a typo should not be a dead end. */
  const statusRaw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = isOrderStatus(statusRaw) ? statusRaw : null;

  const [orders, orderCount, byStatus, spending, active] = await Promise.all([
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

  /* Three figures, all of them counted rather than described. The wishlist
     is not one of them any more: it left the account's menu, and a count
     of it here was a door to a page the menu no longer has. */
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
      icon: TruckIcon,
      label: t.account.onTheWay,
      value: <CountUp value={countFor("pending") + countFor("confirmed") + countFor("shipped")} locale={locale} />,
    },
  ];

  return (
    <AccountShell user={user} t={t}>
      <AccountCardHead title={t.account.menuOrders} />
      <div className="account-card-body">
      {/* -------------------------------- stats ------------------------------ */}
      {/* One strip divided by hairlines rather than four floating cards: the
          figures belong to each other, and the rule between them is the same
          one that separates everything else on this site. `gap-px` over a
          line-coloured background is what draws it — one border, not four. */}
      {/* `dt` and `dd` sit directly in each group: a `<dl>` allows nothing
          between a group's `div` and its terms, and the wrapper that used to
          hold them read as a list with no items. The icon lives inside the
          term instead, where decoration beside a label belongs. */}
      {/* The order on its way, set in the middle: the mark, the status,
          the number large, the facts under it, the four steps, and the way
          to it — the one thing a customer opens this page to check. */}
      {active && (
        <Link href={`/order/${active.number}`} className="active-order">
          <span className="active-order-mark">
            <TruckIcon size={22} />
          </span>
          <span className="eyebrow mt-4">{t.account.activeOrder}</span>
          <span className="mt-2">
            <StatusBadge status={active.status} t={t} />
          </span>
          <span className="mt-3 font-mono text-xl font-bold text-ink-900">{active.number}</span>
          <span className="mt-1 text-sm text-ink-500">
            {formatDate(active.createdAt)} ·{" "}
            {countText(t.admin.productCountOne, t.admin.productCount, active._count.items)} ·{" "}
            {formatPrice(active.total, locale)}
          </span>
          {/* Four steps as four marks, the ones passed filled, the one it
              is on breathing — the timeline on the order page in a line. */}
          <span aria-hidden="true" className="mt-5 flex items-center gap-1.5">
            {STEPS.map((step, index) => (
              <span
                key={step}
                className={`h-2 rounded-pill ${
                  index < activeStep
                    ? "w-5 bg-ink-300"
                    : index === activeStep
                      ? "progress-now w-10 bg-brand-600"
                      : "w-5 bg-ink-100"
                }`}
              />
            ))}
          </span>
          <span className="btn btn-outline btn-sm mt-5">
            {t.account.activeOrderOpen}
            <ChevronRightIcon size={14} />
          </span>
        </Link>
      )}

      {/* The figures on rules, each set in the middle of its cell: the
          number in the serif, the label under it in small capitals with
          its icon. */}
      {/* Three cells across from `sm` up; on a phone each is a row with
          the figure at the left and its label at the right, since a sum
          in lari does not fit a third of a phone. */}
      <dl className={`grid grid-cols-1 sm:grid-cols-3 sm:gap-x-4 ${active ? "mt-8" : ""}`}>
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-4 border-t border-ink-900 py-3 sm:block sm:pt-4 sm:pb-0 sm:text-center"
          >
            <dd className="display-md whitespace-nowrap text-ink-900 tabular-nums">{stat.value}</dd>
            <dt className="eyebrow flex items-center justify-center gap-1.5 sm:mt-2">
              <stat.icon size={13} className="shrink-0 text-brand-600" />
              <span>{stat.label}</span>
            </dt>
          </div>
        ))}
      </dl>

      <div className="mt-10">
        {/* ------------------------------ orders ----------------------------- */}
        <div className="text-center">
          <h2 className="display-sm text-ink-900">{t.account.myOrders}</h2>
          {/* Only when the list is not the whole story. A count beside a
              heading that shows every row is a number for its own sake. */}
          {orderCount > RECENT && (
            <p className="mt-1.5 text-xs text-ink-500">{fill(t.account.showingLast, { count: RECENT })}</p>
          )}
        </div>

        <section id="orders" className="card mt-6 overflow-hidden scroll-mt-[calc(var(--header-h)+1rem)]">

          {/* Links rather than a `<select>`: the filter is part of the address,
              so a customer can bookmark "my delivered orders" and the back
              button behaves. The row offers every status, whether this
              account has reached it or not.
              The row is the whole journey an order takes — waiting,
              confirmed, on its way, delivered — and a customer looking for
              "on its way" should find the word rather than have to work out
              that its absence means none of theirs are. The ones at zero are
              greyed and cannot be pressed, so nothing invites a click that
              leads nowhere. Switches in place: see `OrderFilterTabs`. */}
          {total > 0 && (
            <OrderFilterTabs
              current={status}
              options={[
                { value: null, count: total },
                ...ORDER_STATUSES.map((value) => ({ value, count: countFor(value) })),
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
            <ul className="order-rows">
              {orders.map((order) => (
                <li key={order.id}>
                  {/* Every row the same shape and the same height, whatever
                      the status is called: the pictures, then the number
                      over its date and status, then the sum. A row that
                      grew a line under a long badge made the list jump as
                      the filter changed. */}
                  <Link href={`/order/${order.number}`} className="order-row">
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

                    {/* The number over its status at the left, the sum over
                        its date at the right: two lines on each side, so
                        every row is the same height and nothing is cut. */}
                    <span className="order-row-main">
                      <span className="order-row-number">{order.number}</span>
                      <span className="order-row-meta">
                        <StatusDot status={order.status} />
                        <span className="truncate">{t.status[order.status]}</span>
                      </span>
                    </span>

                    <span className="order-row-end">
                      <span className="order-row-sum">
                        {formatPrice(order.total, locale)}
                        <ChevronRightIcon size={15} aria-hidden="true" className="order-row-chevron" />
                      </span>
                      <span className="order-row-date">{formatDate(order.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
      </div>
    </AccountShell>
  );
}
