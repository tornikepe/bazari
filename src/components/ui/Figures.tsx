import type { ReactNode } from "react";

/**
 * A strip of summary figures above whatever they summarise.
 *
 * Three places had one and all three drew it slightly differently — the same
 * hairline grid, but the numbers set at `text-2xl`, `text-xl` and `text-sm`
 * depending on which page was written that week. A reader who learns what a
 * figure looks like on the customers page should not have to learn it again on
 * a customer.
 *
 * A `<dl>`, because that is what this is: each cell is a term and its value.
 * The grid is hairline-separated rather than gapped — one border and a 1px gap
 * over a line-coloured background, which is how every other grid on the site
 * is divided.
 *
 * Not for the dashboard's four tiles at the top of the overview: those are
 * links with icons, and a thing you can click is not a figure. Not for the home
 * page's hero counts either — those are set at display size as part of a
 * landing page, and shrinking them to match a dashboard would be the tail
 * wagging the dog.
 */

/** Spelled out, because Tailwind cannot see a class name built at runtime. */
const COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function Figures({
  items,
  columns = 3,
  className = "",
}: {
  items: { label: string; value: ReactNode }[];
  columns?: keyof typeof COLUMNS;
  className?: string;
}) {
  return (
    <dl className={`grid gap-px border border-line bg-line ${COLUMNS[columns]} ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-3.5">
          <dt className="label text-ink-500">{item.label}</dt>
          <dd className="mt-1.5 text-xl font-extrabold tracking-tight text-ink-900 tabular-nums">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
