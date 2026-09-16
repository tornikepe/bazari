import type { Dictionary } from "@/lib/i18n";
import { fill } from "@/lib/i18n";

/**
 * How a figure moved against the window before it — "+12%" in green,
 * "−8%" in red, and a dash when there was nothing before to move from.
 * The comparison is named in the title, so the chip says against what.
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
  const label = fill(t.admin.vsPrevious, { count: days });
  if (previous <= 0) {
    return (
      <span title={label} className={`badge bg-ink-100 text-ink-500 ${className}`}>
        —
      </span>
    );
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;
  const up = rounded > 0;
  const flat = rounded === 0;
  return (
    <span
      title={label}
      className={`badge ${
        flat ? "bg-ink-100 text-ink-500" : up ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
      } ${className}`}
    >
      <span aria-hidden="true">{flat ? "·" : up ? "▲" : "▼"}</span>
      {flat ? "0%" : `${up ? "+" : "−"}${Math.abs(rounded)}%`}
    </span>
  );
}
