import { formatDate, formatPrice, shopDayKey } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * Daily revenue over the trailing window.
 *
 * Still no charting library: one series of thirty bars does not justify a
 * dependency, and rendering on the server means there is nothing to hydrate.
 * What it now has is the part that makes a chart a chart rather than a
 * decorative stripe — a scale you can read values off.
 *
 * The previous version drew bars against an invisible axis, labelled only with
 * the first and last date and the peak squeezed between them. You could see
 * that Tuesday was taller than Monday and nothing else: no gridlines, no value
 * for any single day except by hovering, and the peak figure sat mid-row where
 * it read as belonging to whichever bar happened to be under it.
 *
 * ## Colour
 *
 * Bars are `brand-solid`, not `brand-600`: that token has to be light enough
 * to read as a link on a dark surface, so a chart drawn in it glowed in dark
 * mode. Gridlines are `line` and their labels `ink-400`, both of which clear
 * contrast on canvas in either theme — checked by the contrast test, not by
 * eye.
 */

const GRIDLINES = [1, 0.75, 0.5, 0.25];

/**
 * `dd.mm` — day first, matching `formatDate` and every other date on the site.
 * The axis used to print the raw `MM-DD` tail of the ISO key, which is the one
 * date order this project uses nowhere else.
 */
function axisLabel(dayKey: string) {
  const [, month, day] = dayKey.split("-");
  return `${day}.${month}`;
}

/**
 * The top of the scale: the smallest number above the busiest day that also
 * divides into four readable gridlines.
 *
 * Two requirements pull against each other here. The scale has to be a number
 * a person can quarter in their head, and it must not sit so far above the
 * tallest bar that the chart becomes mostly empty. Rounding the *ceiling* up a
 * 1–2–3–5 ladder satisfies neither reliably: a peak of ₾5,643 came out as
 * ₾5,643 exactly, and a peak of ₾250 rounded to ₾250 whose quarters are
 * ₾62.50. Rounding to the next power of ten fixes the labels and ruins the
 * proportions — ₾5,643 would be drawn against ₾10,000.
 *
 * So the *interval* is what gets rounded, and the ceiling is four of them.
 * Every gridline is then a whole multiple of a round number by construction,
 * and the ceiling can never exceed the peak by more than one interval — which
 * is at most a quarter of the plot, and usually far less.
 */
export function niceCeiling(value: number) {
  if (value <= 0) return 100;

  const quarter = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(quarter));

  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const interval = Math.max(1, Math.ceil(step * magnitude));
    if (interval * 4 >= value) return interval * 4;
  }
  return Math.max(4, Math.ceil(10 * magnitude) * 4);
}

export function SalesChart({
  data,
  locale,
  t,
}: {
  data: { date: string; total: number }[];
  locale: Locale;
  t: Dictionary;
}) {
  const peak = Math.max(...data.map((day) => day.total), 0);
  const total = data.reduce((sum, day) => sum + day.total, 0);
  const average = data.length > 0 ? Math.round(total / data.length) : 0;

  if (peak === 0) {
    return <p className="py-12 text-center text-sm text-ink-400">{t.admin.noSales}</p>;
  }

  const ceiling = niceCeiling(peak);
  // Today in shop time, so the highlighted bar is the one the shop is
  // actually living in — `toISOString()` would move the highlight to
  // yesterday's bar for the four hours after midnight in Tbilisi.
  const today = shopDayKey(new Date());

  /**
   * Roughly six labels, whatever the window.
   *
   * A fixed step of seven was right for the thirty-day view it was written
   * for and wrong for both of the others: at seven days it produced two
   * labels for seven bars, and at ninety it produced thirteen crammed into
   * the same width.
   */
  const lastIndex = data.length - 1;
  const step = Math.max(1, Math.round(data.length / 6));
  const tickIndexes = data.flatMap((_, index) => (index % step === 0 ? [index] : []));
  // The last bar earns a label of its own, but only when it is far enough
  // from the previous tick to not collide with it.
  if (lastIndex - (tickIndexes.at(-1) ?? 0) >= Math.max(2, step / 2)) tickIndexes.push(lastIndex);

  const summary = [
    { label: t.admin.chartTotal, value: formatPrice(total, locale) },
    { label: t.admin.chartAverage, value: formatPrice(average, locale) },
    { label: t.admin.chartPeak, value: formatPrice(peak, locale) },
  ];

  return (
    <figure className="mt-4">
      {/* The top gridline's label is centred on the line, so half of it sits
          above the plot. This padding is what stops it being clipped. */}
      <div className="flex gap-3 pt-2.5">
        {/* Fixed width, so the plot does not resize when the figures gain a
            digit — a chart that reflows as the shop grows is its own bug. */}
        <div className="relative h-44 w-20 shrink-0">
          {[...GRIDLINES, 0].map((fraction) => (
            <span
              key={fraction}
              style={{ bottom: `${fraction * 100}%` }}
              className="absolute right-0 translate-y-1/2 text-xs whitespace-nowrap text-ink-400 tabular-nums"
            >
              {formatPrice(Math.round(ceiling * fraction), locale)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-44">
            {GRIDLINES.map((fraction) => (
              <span
                key={fraction}
                style={{ bottom: `${fraction * 100}%` }}
                className="absolute inset-x-0 h-px bg-line"
              />
            ))}
            {/* The baseline is darker than the gridlines: it is the axis, not
                another reading. */}
            <span className="absolute inset-x-0 bottom-0 h-px bg-ink-300" />

            <div className="absolute inset-0 flex items-end gap-px">
              {data.map((day) => {
                // A floor keeps a zero-revenue day as a visible baseline tick
                // rather than a gap, which would read as missing data.
                const height = day.total === 0 ? 2 : Math.max((day.total / ceiling) * 100, 3);

                return (
                  <span
                    key={day.date}
                    className="group relative flex h-full flex-1 items-end"
                    title={`${formatDate(day.date)} · ${
                      day.total === 0 ? t.admin.chartNoRevenue : formatPrice(day.total, locale)
                    }`}
                  >
                    <span
                      style={{ height: `${height}%` }}
                      className={`w-full transition-colors ${
                        day.date === today
                          ? "bg-brand-solid-hover"
                          : "bg-brand-solid group-hover:bg-brand-solid-hover"
                      }`}
                    />
                  </span>
                );
              })}
            </div>
          </div>

          {/* Date axis. Positioned against the plot rather than given one cell
              per bar: a 30-column flex row is ~20px wide per cell, and "07-05"
              wrapped onto two lines in every one of them. */}
          <div className="relative mt-2 h-4">
            {tickIndexes.map((index) => {
              const centre = ((index + 0.5) / data.length) * 100;

              // Clamped by position, not by index. The final tick is often not
              // the final bar — it is whichever multiple of seven came last —
              // and centring a five-character date over a bar at 95% pushes
              // half the label off the plot. This was clipped to "08-0" on a
              // 390px screen.
              const anchor =
                centre > 88 ? "translateX(-100%)" : centre < 12 ? "translateX(0)" : "translateX(-50%)";

              return (
                <span
                  key={data[index].date}
                  style={{ left: `${centre}%`, transform: anchor }}
                  className="absolute top-0 text-xs whitespace-nowrap text-ink-400 tabular-nums"
                >
                  {axisLabel(data[index].date)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <figcaption className="mt-4 grid gap-px border border-line bg-line sm:grid-cols-3">
        {summary.map((item) => (
          <span key={item.label} className="bg-surface px-4 py-2.5">
            <span className="label block text-ink-500">{item.label}</span>
            <span className="mt-0.5 block text-sm font-bold text-ink-900 tabular-nums">
              {item.value}
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
