import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n";

/**
 * Daily revenue as a plain CSS bar chart.
 *
 * Deliberately not a charting library: it's one series of ~30 bars, and a
 * dependency would cost far more than the twenty lines it replaces. Rendered
 * on the server, so there is nothing to hydrate.
 */
export function SalesChart({
  data,
  locale,
  emptyLabel,
}: {
  data: { date: string; total: number }[];
  locale: Locale;
  emptyLabel: string;
}) {
  const peak = Math.max(...data.map((d) => d.total), 0);

  if (peak === 0) {
    return <p className="py-10 text-center text-sm text-ink-400">{emptyLabel}</p>;
  }

  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-1" role="img" aria-label={emptyLabel}>
        {data.map((day) => {
          // A floor of 2% keeps zero-revenue days visible as a baseline tick
          // rather than vanishing entirely.
          const height = day.total === 0 ? 2 : Math.max((day.total / peak) * 100, 4);

          return (
            <div
              key={day.date}
              className="group relative flex-1"
              style={{ height: "100%" }}
              title={`${day.date} · ${formatPrice(day.total, locale)}`}
            >
              <div
                className="absolute bottom-0 w-full bg-brand-solid transition-colors group-hover:bg-brand-solid-hover"
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-ink-400">
        <span>{data[0]?.date.slice(5)}</span>
        <span className="font-semibold text-ink-600">{formatPrice(peak, locale)}</span>
        <span>{data.at(-1)?.date.slice(5)}</span>
      </div>
    </div>
  );
}
