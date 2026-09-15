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
  UserIcon,
} from "@/components/ui/icons";
import { AccountShell } from "@/components/account/AccountShell";
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

  /* The session carries what every page needs; "member since" is wanted by
     this one page only, so it is read here rather than added to the cookie
     that every request in the shop parses. */
  const [orders, orderCount, byStatus, account, spending, favoriteCount] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { items: true } } },
      take: RECENT,
    }),
    prisma.order.count({ where: { userId: user.id, ...(status ? { status } : {}) } }),
    /* Counted per status in one grouped query rather than one count per tab:
       five round trips to label five links is five times the work for the
       same page. */
    prisma.order.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
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
  ]);

  const spent = spending._sum.total ?? 0;

  const countFor = (value: (typeof ORDER_STATUSES)[number]) =>
    byStatus.find((row) => row.status === value)?._count._all ?? 0;
  const total = byStatus.reduce((sum, row) => sum + row._count._all, 0);

  /* Four figures, all of them counted rather than described. The wishlist
     is one of them and the way to the wishlist page — the overview used to
     keep a column of three doors beside the orders, and two of the three
     went where the tabs above already go. */
  const stats = [
    { icon: BagIcon, label: t.account.ordersCount, value: String(orderCount) },
    { icon: TagIcon, label: t.account.spentTotal, value: formatPrice(spent, locale) },
    {
      icon: HeartIcon,
      label: t.favorites.title,
      value: countText(t.favorites.countOne, t.favorites.count, favoriteCount),
      href: "/favorites",
    },
    {
      icon: UserIcon,
      label: t.account.memberSince,
      value: account ? formatDate(account.createdAt) : "—",
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
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
        {stats.map((stat) => {
          const inner = (
            <>
              <dt className="flex items-center gap-3 text-xs text-ink-500">
                {/* Hidden on a phone, where two cells share 390px: the icon
                    and its gap take 52 of the ~146px a cell has, and
                    "₾27,892.00" arrived as "₾27,892…". The label already says
                    which figure this is; the icon is decoration and goes
                    first. */}
                <span
                  aria-hidden="true"
                  className="hidden h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-600 sm:grid"
                >
                  <stat.icon size={18} />
                </span>
                <span className="truncate">{stat.label}</span>
                {stat.href && (
                  <ChevronRightIcon
                    size={14}
                    aria-hidden="true"
                    className="ml-auto shrink-0 text-ink-400"
                  />
                )}
              </dt>
              {/* `tabular-nums` so four figures in a row line up by digit — a
                  strip of numbers that does not is the thing that makes a
                  dashboard look homemade. */}
              <dd className="truncate text-base font-extrabold tracking-tight text-ink-900 tabular-nums sm:pl-[3.25rem] sm:text-lg">
                {stat.value}
              </dd>
            </>
          );
          /* The wishlist cell is a link — the whole cell, so the target is
             the box and not the word. A `<dl>` allows nothing but `div`
             between it and its terms, so the link goes inside the cell. */
          return stat.href ? (
            <div key={stat.label} className="bg-surface">
              <Link
                href={stat.href}
                className="block p-4 transition-colors hover:bg-ink-50"
              >
                {inner}
              </Link>
            </div>
          ) : (
            <div key={stat.label} className="bg-surface p-4">
              {inner}
            </div>
          );
        })}
      </dl>

      <div className="mt-4">
        {/* ------------------------------ orders ----------------------------- */}
        <section id="orders" className="card overflow-hidden scroll-mt-[calc(var(--header-h)+1rem)]">
          <div className="card-head flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-ink-900">{t.account.myOrders}</h2>
            {/* Only when the list is not the whole story. A count beside a
                heading that shows every row is a number for its own sake. */}
            {orderCount > RECENT && (
              <p className="text-xs text-ink-400">
                {fill(t.account.showingLast, { count: RECENT })}
              </p>
            )}
          </div>

          {/* Links rather than a `<select>`: the filter is part of the address,
              so a customer can bookmark "my delivered orders" and the back
              button behaves. Only the statuses this account has actually
              reached are offered — a tab reading "cancelled 0" invites a click
              that leads nowhere. */}
          {orderCount > 0 && (
            <nav
              aria-label={t.account.orderFilter}
              /* No negative margin. The card hides its own overflow, so a
                 strip pulled wider than its padding makes the *card* scroll —
                 which it cannot, so the tabs were clipped at 320px instead.
                 The strip scrolls inside its own box, where it can. */
              className="flex gap-1.5 overflow-x-auto border-b border-line px-5 py-2.5 no-scrollbar"
            >
              {[null, ...ORDER_STATUSES.filter((value) => countFor(value) > 0)].map((value) => {
                const active = status === value;
                return (
                  <Link
                    key={value ?? "all"}
                    href={value ? `/account?status=${value}#orders` : "/account#orders"}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-control px-3 text-sm transition-colors ${
                      active
                        ? "bg-panel font-semibold text-panel-fg"
                        : "border border-line text-ink-600 hover:bg-ink-50"
                    }`}
                  >
                    {value ? t.status[value] : t.account.orderFilterAll}
                    {/* `panel-muted`, the token for quiet text on the dark
                        panel in both themes — `ink-300` is a light grey in
                        one theme and a near-panel grey in the other. */}
                    <span className={active ? "text-panel-muted" : "text-ink-400"}>
                      {value ? countFor(value) : total}
                    </span>
                  </Link>
                );
              })}
            </nav>
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
            <ul className="divide-y divide-line">
              {orders.map((order) => (
                <li key={order.id}>
                  {/* A grid, not a wrapping row. Laid out with `flex-wrap` the
                      totals landed at a different x on every line — ₾104.00
                      above ₾96.50 above ₾194.00, none of them aligned — and a
                      column of money that does not line up cannot be scanned,
                      which is the only thing this list is for. */}
                  <Link
                    href={`/order/${order.number}`}
                    className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-ink-50 sm:grid-cols-[1fr_6.5rem_auto_1rem]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-bold text-ink-900">
                        {order.number}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-400">
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
                    <span className="col-span-2 justify-self-start sm:col-span-1 sm:justify-self-end">
                      <StatusBadge status={order.status} t={t} />
                    </span>

                    <ChevronRightIcon
                      size={16}
                      aria-hidden="true"
                      className="hidden shrink-0 text-ink-300 sm:block"
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
