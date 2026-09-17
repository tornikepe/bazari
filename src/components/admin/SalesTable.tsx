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
  const money = (tetri: number) => formatPrice(tetri, locale);
  const average = (revenue: number, orders: number) => (orders > 0 ? money(revenue / orders) : "—");
  const columns = [
    t.admin.salesOrders,
    t.admin.salesUnits,
    t.admin.salesRevenue,
    t.admin.salesProfit,
    t.admin.salesAvg,
  ];

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
                  className={`w-16 py-1.5 text-center text-xs font-bold transition-colors not-first:border-l not-first:border-line sm:w-20 ${
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-500">
                <th className="px-5 py-2.5 font-semibold">{t.admin.salesDay}</th>
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                    {column}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((day) => (
                <tr
                  key={day.date}
                  className={`transition-colors hover:bg-ink-50 ${day.orders === 0 ? "text-ink-400" : ""}`}
                >
                  <td className="px-5 py-2.5">
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
                  <td className="px-3 py-2.5 text-right tabular-nums">{day.orders}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{day.units}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-ink-900 tabular-nums">
                    {money(day.total)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(day.profit)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{average(day.total, day.orders)}</td>
                  <td className="pr-4 text-ink-300">
                    <ChevronRightIcon size={14} aria-hidden="true" />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-canvas text-sm font-bold text-ink-900">
                <td className="px-5 py-3">{fill(t.admin.salesTotalRow, { count: daily.length })}</td>
                <td className="px-3 py-3 text-right tabular-nums">{total.orders}</td>
                <td className="px-3 py-3 text-right tabular-nums">{total.units}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(total.total)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{money(total.profit)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{average(total.total, total.orders)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
