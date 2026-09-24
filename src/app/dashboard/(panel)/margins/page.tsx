import Image from "next/image";
import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import {
  DEFAULT_MARGIN_RANGE,
  MARGIN_RANGES,
  getMarginReport,
  isMarginRange,
  type MarginRange,
  type MarginRow,
} from "@/lib/margins";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { AdminToolbar, type SelectFilter } from "@/components/admin/AdminToolbar";
import { EditableNumber } from "@/components/admin/EditableNumber";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyShelfArt, NoResultsArt } from "@/components/ui/illustrations";
import { AlertIcon } from "@/components/ui/icons";
import type { RawSearchParams } from "@/lib/filters";

const SHOWS = ["stock", "nocost"] as const;
const SORTS = ["expected", "earned", "margin", "name"] as const;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * What the shop paid, what it will take, and what is left.
 *
 * The one page that answers "how much did I put in, how much will I get
 * out, and what is mine" — and the one place both numbers behind that can
 * be typed in. Buying price and selling price are edited where they are
 * read, product by product, because a shop owner who has just unpacked a
 * delivery has thirty of them to enter and no patience for thirty forms.
 *
 * Two halves, and they answer different questions. The first four figures
 * are the stockroom: what the pieces on the shelf cost, what they are
 * priced at, and the difference — money not yet made. The rest is the
 * orders: what sold in the window and what stayed after the buying price
 * each line carried on the day it sold. Repricing tomorrow moves the first
 * and leaves the second alone, which is the point of keeping both.
 */
export default async function MarginsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;

  /* `Number("")` is 0, and 0 is a window this page offers — "everything
     ever sold". Without the emptiness check a page opened with no range
     at all answered the widest question rather than the default one. */
  const rangeRaw = one(params.range);
  const range: MarginRange =
    rangeRaw && isMarginRange(Number(rangeRaw)) ? (Number(rangeRaw) as MarginRange) : DEFAULT_MARGIN_RANGE;
  const query = one(params.q).toLowerCase();
  const showRaw = one(params.show);
  const show = (SHOWS as readonly string[]).includes(showRaw) ? showRaw : "";
  const sortRaw = one(params.sort);
  const sort = (SORTS as readonly string[]).includes(sortRaw) ? sortRaw : "expected";

  const report = await getMarginReport(range);
  const money = (tetri: number) => formatPrice(tetri, locale);
  const nameOf = (row: MarginRow) => (locale === "ka" ? row.nameKa : row.nameEn);

  /* The totals above are the whole shop, always. Narrowing the list is a
     way of finding a row, not a way of asking a different question — a
     search for "shoes" must not make the shop's stock look like it is
     worth four hundred lari. */
  const rows = report.rows
    .filter((row) => {
      if (show === "stock" && row.stock <= 0) return false;
      if (show === "nocost" && row.cost > 0) return false;
      if (!query) return true;
      return (
        row.nameKa.toLowerCase().includes(query) ||
        row.nameEn.toLowerCase().includes(query) ||
        row.sku.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      switch (sort) {
        case "earned":
          return b.earned - a.earned;
        case "margin":
          return b.percent - a.percent;
        case "name":
          return nameOf(a).localeCompare(nameOf(b), locale === "ka" ? "ka-GE" : "en-GB");
        default:
          return b.expected - a.expected;
      }
    });

  const filtered = Boolean(query || show);

  const figures = [
    { label: t.admin.mgStockCost, hint: t.admin.mgStockCostHint, value: money(report.totals.stockCost) },
    { label: t.admin.mgStockRetail, hint: t.admin.mgStockRetailHint, value: money(report.totals.stockRetail) },
    {
      label: t.admin.mgExpected,
      hint: t.admin.mgExpectedHint,
      value: money(report.totals.expected),
      tone: report.totals.expected < 0 ? "text-danger" : "text-ink-900",
    },
    {
      label: t.admin.mgEarned,
      hint: t.admin.mgEarnedHint,
      value: money(report.totals.earned),
      tone: report.totals.earned < 0 ? "text-danger" : "text-success",
    },
  ];

  const filters: SelectFilter[] = [
    {
      name: "show",
      label: t.admin.mgAll,
      value: show,
      options: [
        { value: "", label: t.admin.mgAll },
        { value: "stock", label: t.admin.mgInStock },
        { value: "nocost", label: t.admin.mgOnlyNoCost },
      ],
    },
    {
      name: "sort",
      label: t.admin.sortBy,
      value: sort === "expected" ? "" : sort,
      options: [
        { value: "", label: t.admin.mgSortExpected },
        { value: "earned", label: t.admin.mgSortEarned },
        { value: "margin", label: t.admin.mgSortMargin },
        { value: "name", label: t.admin.mgSortName },
      ],
    },
  ];

  /* The window belongs to the sold half only, so it rides in the URL
     beside the filters rather than replacing them. */
  const keep = (next: MarginRange) => {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (show) search.set("show", show);
    if (sort !== "expected") search.set("sort", sort);
    if (next !== DEFAULT_MARGIN_RANGE) search.set("range", String(next));
    const tail = search.toString();
    return `/dashboard/margins${tail ? `?${tail}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.margins}
        lead={t.admin.marginsHint}
        action={
          <div
            role="group"
            aria-label={t.admin.chartRange}
            className="flex items-center overflow-hidden rounded-control border border-line"
          >
            {MARGIN_RANGES.map((days) => {
              const current = days === range;
              return (
                <Link
                  key={days}
                  href={keep(days)}
                  aria-current={current ? "true" : undefined}
                  scroll={false}
                  className={`w-20 py-1.5 text-center text-xs font-bold transition-colors not-first:border-l not-first:border-line ${
                    current ? "bg-ink-900 text-surface" : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  {days === 0 ? t.admin.mgRangeAll : fill(t.admin.chartDays, { count: days })}
                </Link>
              );
            })}
          </div>
        }
      />

      {/* ------------------------------ figures ----------------------------- */}
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line lg:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0 bg-surface px-4 py-3.5">
            {/* These labels wrap rather than truncate. "What the stock is
                priced at" cut to "What the stock is…" is a figure nobody
                can read, and there are only four of them. */}
            <dt className="label leading-snug text-ink-500">{figure.label}</dt>
            <dd className={`mt-1.5 truncate text-lg font-extrabold tracking-tight tabular-nums sm:text-xl ${figure.tone ?? "text-ink-900"}`}>
              {figure.value}
            </dd>
            <p className="mt-0.5 text-xs leading-snug text-ink-400">{figure.hint}</p>
          </div>
        ))}
      </dl>

      {/* What the window's sales came to, under the four figures as one
          quiet line: they are the workings behind "profit made". */}
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
        <span>
          {t.admin.mgRevenue}: <strong className="font-bold tabular-nums text-ink-800">{money(report.totals.revenue)}</strong>
        </span>
        <span>
          {t.admin.mgSoldCost}: <strong className="font-bold tabular-nums text-ink-800">{money(report.totals.soldCost)}</strong>
        </span>
        <span>
          {t.admin.mgPercent}: <strong className="font-bold tabular-nums text-ink-800">{report.totals.earnedPercent}%</strong>
        </span>
      </p>

      {/* A figure that is wrong, said plainly: every product with no buying
          price counts its whole selling price as profit. */}
      {report.totals.withoutCost > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-card border border-warning/40 bg-warning-soft px-3.5 py-2.5 text-xs leading-snug text-ink-700">
          <AlertIcon size={15} className="mt-px shrink-0 text-warning" />
          <span>
            {fill(t.admin.mgNoCostHint, { count: report.totals.withoutCost })}{" "}
            <Link href="/dashboard/margins?show=nocost" className="font-semibold text-ink-900 underline">
              {t.admin.mgOnlyNoCost}
            </Link>
          </span>
        </p>
      )}

      <div className="mt-4">
        <AdminToolbar
          basePath="/dashboard/margins"
          search={one(params.q)}
          filters={filters}
          hasActive={Boolean(query || show || sort !== "expected")}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="card mt-4"
          art={filtered ? <NoResultsArt size={88} /> : <EmptyShelfArt size={88} />}
          title={filtered ? t.admin.noMatches : t.admin.noProducts}
          text={filtered ? t.admin.noMatchesHint : t.admin.noProductsHint}
          titleAs="p"
          action={
            filtered ? (
              <Link href="/dashboard/margins" className="btn btn-outline btn-md">
                {t.admin.resetFilters}
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-400">{t.admin.mgEditHint}</p>

          {/* Cards on a phone: eight columns cannot shrink that far. */}
          <ul className="mt-3 flex flex-col gap-2 lg:hidden">
            {rows.map((row) => (
              <li key={row.id} className="card card-pad-tight">
                <div className="flex gap-3">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control border border-line bg-ink-50">
                    <Image src={row.image} alt="" fill sizes="48px" className="object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/products/${row.id}`}
                      className="line-clamp-2 text-sm font-semibold text-ink-900 hover:underline"
                    >
                      {nameOf(row)}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-ink-400">{row.sku}</p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="label block text-ink-400">{t.admin.mgStock}</span>
                    <span className="text-sm font-bold text-ink-900 tabular-nums">{row.stock}</span>
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line pt-3 text-sm">
                  <div>
                    <dt className="label text-ink-400">{t.admin.mgCost}</dt>
                    <dd className="mt-0.5">
                      <EditableNumber
                        id={row.id}
                        field="cost"
                        value={row.cost / 100}
                        display={
                          <span className={row.cost === 0 ? "font-bold text-warning" : "font-bold text-ink-900"}>
                            {row.cost === 0 ? "—" : money(row.cost)}
                          </span>
                        }
                        name={nameOf(row)}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-ink-400">{t.admin.mgPrice}</dt>
                    <dd className="mt-0.5">
                      <EditableNumber
                        id={row.id}
                        field="price"
                        value={row.price / 100}
                        display={<span className="font-bold text-ink-900">{money(row.price)}</span>}
                        name={nameOf(row)}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-ink-400">{t.admin.mgUnit}</dt>
                    <dd className={`mt-0.5 font-bold tabular-nums ${row.unit < 0 ? "text-danger" : "text-ink-900"}`}>
                      {money(row.unit)} · {row.percent}%
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-ink-400">{t.admin.mgExpected}</dt>
                    <dd className={`mt-0.5 font-bold tabular-nums ${row.expected < 0 ? "text-danger" : "text-ink-900"}`}>
                      {money(row.expected)}
                    </dd>
                  </div>
                  <div className="col-span-2 border-t border-line pt-2">
                    <dt className="label text-ink-400">{t.admin.mgEarned}</dt>
                    <dd className={`mt-0.5 font-bold tabular-nums ${row.earned < 0 ? "text-danger" : "text-success"}`}>
                      {money(row.earned)}
                      <span className="ml-1.5 text-xs font-normal text-ink-400">
                        {row.sold} {t.admin.anUnits}
                      </span>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-3 hidden overflow-hidden rounded-card border border-line lg:block">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left">
                <tr className="label text-ink-500">
                  <th className="px-3 py-2.5 font-semibold">{t.admin.mgProduct}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.admin.mgStock}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.admin.mgCost}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.admin.mgPrice}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.admin.mgUnit}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.admin.mgStockCost}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.admin.mgExpected}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">{t.admin.mgEarned}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((row) => (
                  <tr key={row.id} className="bg-surface transition-colors hover:bg-ink-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-control border border-line bg-ink-50">
                          <Image src={row.image} alt="" fill sizes="36px" className="object-cover" />
                        </span>
                        <span className="min-w-0">
                          <Link
                            href={`/dashboard/products/${row.id}`}
                            className="line-clamp-1 font-semibold text-ink-900 hover:underline"
                          >
                            {nameOf(row)}
                          </Link>
                          <span className="block font-mono text-xs text-ink-400">{row.sku}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{row.stock}</td>
                    <td className="px-3 py-2.5 text-right">
                      <EditableNumber
                        id={row.id}
                        field="cost"
                        value={row.cost / 100}
                        display={
                          <span className={row.cost === 0 ? "font-semibold text-warning" : "text-ink-700"}>
                            {row.cost === 0 ? "—" : money(row.cost)}
                          </span>
                        }
                        name={nameOf(row)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <EditableNumber
                        id={row.id}
                        field="price"
                        value={row.price / 100}
                        display={<span className="font-semibold text-ink-900">{money(row.price)}</span>}
                        name={nameOf(row)}
                      />
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${row.unit < 0 ? "text-danger" : "text-ink-700"}`}>
                      {money(row.unit)}
                      <span className="ml-1.5 text-xs text-ink-400">{row.percent}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">{money(row.stockCost)}</td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                        row.expected < 0 ? "text-danger" : "text-ink-900"
                      }`}
                    >
                      {money(row.expected)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                        row.earned < 0 ? "text-danger" : row.earned > 0 ? "text-success" : "text-ink-400"
                      }`}
                    >
                      {money(row.earned)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
