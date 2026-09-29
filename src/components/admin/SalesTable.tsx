import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/format";
import { fill, type Dictionary, type Locale } from "@/lib/i18n";
import { RANGE_DAYS, type RangeDays } from "@/lib/analytics";
import { ChevronRightIcon } from "@/components/ui/icons";

export type DayRow = {
  /** `YYYY-MM-DD` in shop time. */
  date: string;
  total: number;
  orders: number;
  units: number;
  profit: number;
};

/**
 * The window's sales, one line per day, everything in money.
 *
 * The chart above says the shape; this says the figures — how many orders
 * a day took, how many units, what they came to, what was left of it, and
 * what an order was worth on average. The period is picked at the top:
 * the three quick windows, or any two dates. Days with no orders are left
 * out unless asked for, so a quiet month is not thirty lines of dashes;
 * the footer counts every day in the window either way.
 *
 * Newest day first, since the day that matters is usually today. A day is
 * a link to that day's orders.
 */
export function SalesTable({
  daily,
  from,
  to,
  range,
  showEmpty,
  locale,
  t,
  basePath = "/dashboard",
}: {
  daily: DayRow[];
  from: string;
  to: string;
  /** The quick window in force, or null when two dates were picked. */
  range: RangeDays | null;
  showEmpty: boolean;
  locale: Locale;
  t: Dictionary;
  basePath?: string;
}) {
  const rows = [...daily].reverse().filter((day) => showEmpty || day.orders > 0);
  const total = daily.reduce(
    (sum, day) => ({
      total: sum.total + day.total,
      orders: sum.orders + day.orders,
      units: sum.units + day.units,
      profit: sum.profit + day.profit,
    }),
    { total: 0, orders: 0, units: 0, profit: 0 },
  );
  const peak = Math.max(1, ...daily.map((day) => day.total));

  /* A week, on a phone. Thirty rows of figures is most of a screen's height
     spent scrolling past days nothing happened on, and the days a shop owner
     opens this for are the last few. The rest are one tap away, and from
     `sm` up they are all simply there. */
  const PHONE_ROWS = 7;
  const foldable = rows.length > PHONE_ROWS;
  const money = (tetri: number) => formatPrice(tetri, locale);
  const average = (revenue: number, orders: number) => (orders > 0 ? money(revenue / orders) : "—");
  /* Two of the six are held back on a phone. The table was six columns and
     six hundred and forty pixels wide inside a sideways scroller, so on a
     390-pixel screen profit and average order were off the edge with nothing
     to say they existed — a column you have to discover by dragging is a
     column that is not there. The day, its orders, its items and its takings
     fit; the two that are dropped are on the day's own page, one tap away
     through the row. */
  const columns = [
    { label: t.admin.salesOrders, phone: true },
    { label: t.admin.salesUnits, phone: true },
    { label: t.admin.salesRevenue, phone: true },
    { label: t.admin.salesProfit, phone: false },
    { label: t.admin.salesAvg, phone: false },
  ];

  /** Applied to the head, the body and the foot of a held-back column. */
  const wide = "hidden sm:table-cell";

  return (
    <section className="card mt-4 overflow-hidden">
      <div className="card-head">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-ink-900">{t.admin.salesTable}</h2>
            <p className="mt-0.5 text-xs text-ink-500">{t.admin.salesTableHint}</p>
          </div>
        </div>

        {/* The period: three quick windows, or two dates. A plain GET form,
            so the period is in the address and a view can be reloaded or
            sent to somebody. */}
        <form
          method="get"
          action={basePath}
          /* Two columns on a phone — the quick windows across both, a date
             in each, the checkbox and the button on the last row — and one
             wrapping row from `sm` up. */
          className="mt-3 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:gap-x-3"
        >
          <div role="group" aria-label={t.admin.chartRange} className="col-span-2 flex w-fit items-center overflow-hidden rounded-control border border-line">
            {RANGE_DAYS.map((days) => {
              const current = days === range;
              return (
                <Link
                  key={days}
                  href={`${basePath}?range=${days}`}
                  aria-current={current ? "true" : undefined}
                  scroll={false}
                  /* 44px on a phone, as on every other range control in
                     the dashboard. Thirty pixels is a mouse's size. */
                  className={`flex min-h-11 w-16 items-center justify-center py-1.5 text-center text-xs font-bold transition-colors not-first:border-l not-first:border-line sm:min-h-8 sm:w-20 ${
                    current ? "bg-ink-900 text-surface" : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                  }`}
                >
                  {fill(t.admin.chartDays, { count: days })}
                </Link>
              );
            })}
          </div>
          <label className="flex min-w-0 items-center gap-1.5 text-xs text-ink-500">
            {t.admin.salesFrom}
            <input type="date" name="from" defaultValue={from} max={to} className="field h-8 min-w-0 flex-1 px-2 text-xs sm:w-36 sm:flex-none" />
          </label>
          <label className="flex min-w-0 items-center gap-1.5 text-xs text-ink-500">
            {t.admin.salesTo}
            <input type="date" name="to" defaultValue={to} min={from} className="field h-8 min-w-0 flex-1 px-2 text-xs sm:w-36 sm:flex-none" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-600">
            <input type="checkbox" name="empty" value="1" defaultChecked={showEmpty} className="h-4 w-4 accent-brand-600" />
            {t.admin.salesShowEmpty}
          </label>
          <button type="submit" className="btn btn-outline btn-sm justify-self-end">
            {t.admin.salesShow}
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-400">{t.admin.salesQuiet}</p>
      ) : (
        <>
          {/* A disclosure with no JavaScript in it: the checkbox is the
              state, the label is the control, and the rule that shows the
              held-back rows lives in the stylesheet. The table is rendered
              by the server and stays there. */}
          {foldable && (
            <input type="checkbox" id="sales-more" className="sales-more-state sr-only" />
          )}
          <div className="sales-body overflow-x-auto">
            <table className="w-full min-w-0 text-sm sm:min-w-[40rem]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-500">
                <th className="px-3 py-2.5 font-semibold sm:px-5">{t.admin.salesDay}</th>
                {columns.map((column) => (
                  <th
                    key={column.label}
                    className={`px-2 py-2.5 text-right font-semibold whitespace-nowrap sm:px-3 ${column.phone ? "" : wide}`}
                  >
                    {column.label}
                  </th>
                ))}
                <th className="hidden w-8 sm:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((day, index) => (
                <tr
                  key={day.date}
                  className={`transition-colors hover:bg-ink-50 ${day.orders === 0 ? "text-ink-400" : ""} ${
                    foldable && index >= PHONE_ROWS ? "sales-extra" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 sm:px-5">
                    <Link
                      href={`/dashboard/orders?day=${day.date}`}
                      className="group flex items-center gap-3 font-semibold text-ink-900 hover:text-brand-600"
                    >
                      <span className="tabular-nums">{formatDate(`${day.date}T12:00:00+04:00`)}</span>
                      {/* The day's share of the busiest day, as a bar: the
                          chart in a line, next to the figure. */}
                      <span
                        aria-hidden="true"
                        className="hidden h-1.5 w-20 overflow-hidden rounded-pill bg-ink-100 sm:block"
                      >
                        <span
                          className="block h-full rounded-pill bg-brand-500"
                          style={{ width: `${(day.total / peak) * 100}%` }}
                        />
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums sm:px-3">{day.orders}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums sm:px-3">{day.units}</td>
                  <td className="px-2 py-2.5 text-right font-semibold text-ink-900 tabular-nums sm:px-3">
                    {money(day.total)}
                  </td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${wide}`}>{money(day.profit)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${wide}`}>
                    {average(day.total, day.orders)}
                  </td>
                  <td className="hidden pr-4 text-ink-300 sm:table-cell">
                    <ChevronRightIcon size={14} aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-canvas text-sm font-bold text-ink-900">
                <td className="px-3 py-3 sm:px-5">{fill(t.admin.salesTotalRow, { count: daily.length })}</td>
                <td className="px-2 py-3 text-right tabular-nums sm:px-3">{total.orders}</td>
                <td className="px-2 py-3 text-right tabular-nums sm:px-3">{total.units}</td>
                <td className="px-2 py-3 text-right tabular-nums sm:px-3">{money(total.total)}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${wide}`}>{money(total.profit)}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${wide}`}>
                  {average(total.total, total.orders)}
                </td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
            </table>
          </div>

          {foldable && (
            <label htmlFor="sales-more" className="sales-more">
              {fill(t.admin.salesShowAll, { count: rows.length })}
            </label>
          )}
        </>
      )}
    </section>
  );
}
