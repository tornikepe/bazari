import type { Dictionary } from "@/lib/i18n";
import { fill } from "@/lib/i18n";

/**
 * How a figure moved against the window before it, in words: "12% more
 * than the 30 days before", green with an arrow up; "8% less", red with
 * an arrow down; "the same"; or "nothing in the 30 days before" when there
 * is nothing to compare with. A chip that said "+12%" left the reader to
 * work out what the twelve was of.
 */
export function Delta({
  current,
  previous,
  days,
  t,
  className = "",
}: {
  current: number;
  previous: number;
  days: number;
  t: Dictionary;
  className?: string;
}) {
  if (previous <= 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-ink-400 ${className}`}>
        {fill(t.admin.deltaNone, { count: days })}
      </span>
    );
  }
  const change = Math.round(((current - previous) / previous) * 1000) / 10;
  if (change === 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-ink-500 ${className}`}>
        {fill(t.admin.deltaSame, { count: days })}
      </span>
    );
  }
  const up = change > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        up ? "text-success" : "text-danger"
      } ${className}`}
    >
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {fill(up ? t.admin.deltaUp : t.admin.deltaDown, {
        percent: Math.abs(change),
        count: days,
      })}
    </span>
  );
}
