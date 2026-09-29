import Link from "next/link";
import { RANGE_DAYS, type RangeDays } from "@/lib/analytics";
import { fill } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";

/**
 * 7 / 30 / 90 days.
 *
 * Links rather than buttons, with the range in the query string: the chart is
 * rendered on the server, so switching window is a navigation, and putting it
 * in the URL means a particular view can be bookmarked, reloaded, or sent to
 * somebody else. A client-side toggle would have had to fetch and re-render
 * the same data for none of that.
 *
 * Each tab is a fixed width. "7 დღე" and "90 days" are different lengths, and
 * a row of tabs that reflows when you press one is the exact thing the rest of
 * the site goes out of its way to avoid.
 */
export function ChartRangeTabs({
  active,
  t,
  basePath = "/dashboard",
}: {
  active: RangeDays;
  t: Dictionary;
  /** Which page the window belongs to; the overview's by default. */
  basePath?: string;
}) {
  return (
    <div role="group" aria-label={t.admin.chartRange} className="flex items-center overflow-hidden rounded-control border border-line">
      {RANGE_DAYS.map((days) => {
        const current = days === active;
        return (
          <Link
            key={days}
            href={`${basePath}?range=${days}`}
            aria-current={current ? "true" : undefined}
            scroll={false}
            /* 44px on a phone, 30 from `sm` up. These were 30 everywhere,
               which is a comfortable size for a mouse and a poor one for a
               thumb — and on the margins, analytics and traffic pages this
               row is the only way to change what is being looked at. */
            className={`flex min-h-11 w-20 items-center justify-center py-1.5 text-center text-xs font-bold transition-colors not-first:border-l not-first:border-line sm:min-h-8 ${
              current ? "bg-ink-900 text-surface" : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
            }`}
          >
            {fill(t.admin.chartDays, { count: days })}
          </Link>
        );
      })}
    </div>
  );
}
