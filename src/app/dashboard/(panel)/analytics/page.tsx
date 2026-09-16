import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { DEFAULT_RANGE, isRangeDays } from "@/lib/analytics";
import { getProductAnalytics, type FunnelRow } from "@/lib/product-analytics";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChartRangeTabs } from "@/components/admin/ChartRangeTabs";
import { MarketingSpend } from "@/components/admin/MarketingSpend";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt } from "@/components/ui/illustrations";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { RawSearchParams } from "@/lib/filters";
import type { Dictionary } from "@/lib/i18n";

/** How many product rows the page draws before pointing at "all". */
const TOP = 25;

/**
 * What every product and every category did for the shop.
 *
 * Six questions, asked of each: how many saw it, how many opened it, how
 * many put it in the cart, how many bought it, what a customer cost to
 * bring, and what was left as profit. The counts are kept without a cookie
 * (see `lib/traffic.ts`), the sales are the orders, and the one figure the
 * shop has to type in — what it spent on ads — has its own card here,
 * because "cost per customer" is that figure divided and "net profit" is
 * that figure taken off.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const rangeRaw = Number(Array.isArray(params.range) ? params.range[0] : params.range);
  const range = isRangeDays(rangeRaw) ? rangeRaw : DEFAULT_RANGE;
  const showAll = (Array.isArray(params.all) ? params.all[0] : params.all) === "1";

  const report = await getProductAnalytics(range);
  const count = new Intl.NumberFormat(locale === "ka" ? "ka-GE" : "en-GB");
  const money = (tetri: number) => formatPrice(tetri, locale);
  const percent = (part: number, whole: number) =>
    whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : "—";
  const nothing =
    report.totals.views === 0 &&
    report.totals.clicks === 0 &&
    report.totals.carts === 0 &&
    report.totals.orders === 0;

  const products = showAll ? report.products : report.products.slice(0, TOP);
  const nameOf = (row: FunnelRow) => (locale === "ka" ? row.name.ka : row.name.en);

  const funnel = [
    { label: t.admin.anViews, hint: t.admin.anViewsHint, value: report.totals.views },
    { label: t.admin.anClicks, hint: t.admin.anClicksHint, value: report.totals.clicks },
    { label: t.admin.anCarts, hint: t.admin.anCartsHint, value: report.totals.carts },
    { label: t.admin.anOrders, hint: t.admin.anOrdersHint, value: report.totals.orders },
    { label: t.admin.anTracks, hint: t.admin.anTracksHint, value: report.totals.tracks },
  ];

  const figures = [
    { label: t.admin.anRevenue, value: money(report.totals.revenue), hint: null },
    { label: t.admin.anProfit, value: money(report.totals.profit), hint: t.admin.anProfitHint },
    {
      label: t.admin.anNetProfit,
      value: money(report.netProfit),
      hint: t.admin.anNetProfitHint,
      tone: report.netProfit < 0 ? "text-danger" : "text-success",
    },
    {
      label: t.admin.anCac,
      value: report.cac === null ? "—" : money(report.cac),
      hint: `${t.admin.anCacHint} · ${count.format(report.newCustomers)} ${t.admin.anNewCustomers}`,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.analytics}
        lead={t.admin.analyticsHint}
        action={<ChartRangeTabs active={range} t={t} basePath="/dashboard/analytics" />}
      />

      {/* ------------------------------ money ------------------------------ */}
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0 bg-surface px-4 py-3.5">
            <dt className="label truncate text-ink-500" title={figure.label}>
              {figure.label}
            </dt>
            <dd
              className={`mt-1.5 truncate text-lg font-extrabold tracking-tight tabular-nums sm:text-xl ${
                "tone" in figure && figure.tone ? figure.tone : "text-ink-900"
              }`}
            >
              {figure.value}
            </dd>
            {figure.hint && <p className="mt-1 text-xs leading-snug text-ink-400">{figure.hint}</p>}
          </div>
        ))}
      </dl>

      {nothing ? (
        <EmptyState
          className="card mt-4"
          art={<EmptyOrdersArt size={88} />}
          title={t.admin.anNone}
          text={t.admin.anNoneHint}
          titleAs="p"
        />
      ) : (
        <>
          {/* ------------------------------ funnel ---------------------------- */}
          {/* Five figures in a row with the drop between each: the number
              that matters is not any one of them but how many of one became
              the next. */}
          <section className="card mt-4 card-pad">
            <h2 className="text-sm font-bold text-ink-900">{t.admin.anFunnel}</h2>
            <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-0">
              {funnel.map((step, index) => {
                /* The drop from the step before — not on the last one, which
                   is looked at more than once per order and would read as
                   a conversion of three hundred percent. */
                const previous = index > 0 && index < funnel.length - 1 ? funnel[index - 1]!.value : null;
                return (
                  <li key={step.label} className="relative sm:px-3 sm:first:pl-0 sm:last:pr-0">
                    {index > 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 -left-3 hidden -translate-y-1/2 text-ink-300 sm:block"
                      >
                        <ChevronRightIcon size={16} />
                      </span>
                    )}
                    <p className="text-2xl font-extrabold tracking-tight text-ink-900 tabular-nums">
                      {count.format(step.value)}
                    </p>
                    <p className="text-sm font-semibold text-ink-800">{step.label}</p>
                    <p className="text-xs text-ink-400">{step.hint}</p>
                    {previous !== null && (
                      <p className="mt-1 text-xs font-semibold text-brand-600 tabular-nums">
                        {percent(step.value, previous)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-500">
              {t.admin.anConversion} ({t.admin.anConversionHint}):{" "}
              <span className="font-bold text-ink-900 tabular-nums">
                {percent(report.totals.orders, report.totals.views)}
              </span>
            </p>
          </section>

          {/* --------------------------- by category -------------------------- */}
          <FunnelTable
            title={t.admin.anByCategory}
            firstColumn={t.admin.anCategory}
            rows={report.categories}
            nameOf={nameOf}
            t={t}
            count={count}
            money={money}
            percent={percent}
          />

          {/* ---------------------------- by product -------------------------- */}
          <FunnelTable
            title={t.admin.anByProduct}
            firstColumn={t.admin.anProduct}
            rows={products}
            nameOf={nameOf}
            hrefOf={(row) => (row.slug ? `/dashboard/products/${row.id}` : null)}
            t={t}
            count={count}
            money={money}
            percent={percent}
            foot={
              report.products.length > TOP ? (
                <Link
                  href={
                    showAll
                      ? `/dashboard/analytics?range=${range}`
                      : `/dashboard/analytics?range=${range}&all=1`
                  }
                  className="btn btn-ghost btn-sm"
                >
                  {showAll ? fill(t.admin.anTopProducts, { count: TOP }) : t.admin.anAllProducts}
                </Link>
              ) : null
            }
          />
        </>
      )}

      {/* ------------------------------- spend ----------------------------- */}
      <section className="card mt-4 card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink-900">{t.admin.anSpend}</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{t.admin.anSpendHint}</p>
          </div>
          <p className="text-right text-xs text-ink-500">
            {t.admin.anSpendInWindow}
            <span className="block text-base font-extrabold text-ink-900 tabular-nums">
              {money(report.spend)}
            </span>
          </p>
        </div>
        <div className="mt-3">
          <MarketingSpend months={report.months} />
        </div>
      </section>
    </div>
  );
}

/**
 * One table for both lists: the name, then the five steps, then the money.
 * Figures right-aligned and tabular so a column can be read down; the
 * conversion from views to orders as its own column, since that is the one
 * comparison the two lists are for.
 */
function FunnelTable({
  title,
  firstColumn,
  rows,
  nameOf,
  hrefOf,
  t,
  count,
  money,
  percent,
  foot,
}: {
  title: string;
  firstColumn: string;
  rows: FunnelRow[];
  nameOf: (row: FunnelRow) => string;
  hrefOf?: (row: FunnelRow) => string | null;
  t: Dictionary;
  count: Intl.NumberFormat;
  money: (tetri: number) => string;
  percent: (part: number, whole: number) => string;
  foot?: React.ReactNode;
}) {
  const columns = [
    t.admin.anViews,
    t.admin.anClicks,
    t.admin.anCarts,
    t.admin.anOrders,
    t.admin.anUnits,
    t.admin.anConversion,
    t.admin.anRevenue,
    t.admin.anProfit,
  ];

  return (
    <section className="card mt-4 overflow-hidden">
      <div className="card-head flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink-900">{title}</h2>
        {foot}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-500">
              <th className="px-5 py-2.5 font-semibold">{firstColumn}</th>
              {columns.map((column) => (
                <th key={column} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const href = hrefOf?.(row) ?? null;
              const cells = [
                count.format(row.views),
                count.format(row.clicks),
                count.format(row.carts),
                count.format(row.orders),
                count.format(row.units),
                percent(row.orders, row.views),
                money(row.revenue),
                money(row.profit),
              ];
              return (
                <tr key={row.id} className="transition-colors hover:bg-ink-50">
                  <td className="max-w-64 px-5 py-2.5">
                    {href ? (
                      <Link href={href} className="block truncate font-semibold text-ink-900 hover:text-brand-600">
                        {nameOf(row)}
                      </Link>
                    ) : (
                      <span className="block truncate font-semibold text-ink-900">{nameOf(row)}</span>
                    )}
                  </td>
                  {cells.map((cell, index) => (
                    <td
                      key={columns[index]}
                      className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap ${
                        index === 7 ? (row.profit < 0 ? "font-semibold text-danger" : "font-semibold text-ink-900") : "text-ink-700"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
