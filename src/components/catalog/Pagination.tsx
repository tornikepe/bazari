import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { buildQuery, type CatalogFilters } from "@/lib/filters";

/**
 * Windowed pager: always shows first and last, plus a run around the current
 * page, with `…` for the gaps. Plain links, so it works without JS.
 */
function pageList(current: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);
  if (current <= 3) pages.add(2).add(3).add(4);
  if (current >= total - 2) pages.add(total - 1).add(total - 2).add(total - 3);

  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  for (const [index, page] of sorted.entries()) {
    if (index > 0 && page - sorted[index - 1] > 1) result.push("gap");
    result.push(page);
  }
  return result;
}

export function Pagination({
  filters,
  page,
  pageCount,
  labels,
}: {
  filters: CatalogFilters;
  page: number;
  pageCount: number;
  labels: { previous: string; next: string; page: string };
}) {
  if (pageCount <= 1) return null;

  const href = (target: number) => `/catalog${buildQuery(filters, { page: target })}`;

  return (
    <nav aria-label={labels.page} className="mt-8 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} aria-label={labels.previous} className="btn btn-outline btn-sm">
          <ChevronLeftIcon size={15} />
          <span className="hidden sm:inline">{labels.previous}</span>
        </Link>
      ) : (
        <span aria-disabled="true" className="btn btn-outline btn-sm pointer-events-none opacity-45">
          <ChevronLeftIcon size={15} />
          <span className="hidden sm:inline">{labels.previous}</span>
        </span>
      )}

      <div className="flex items-center gap-1">
        {pageList(page, pageCount).map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1.5 text-sm text-ink-400">
              …
            </span>
          ) : (
            <Link
              key={entry}
              href={href(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={`grid h-9 min-w-9 place-items-center rounded-control px-2.5 text-sm font-semibold transition-colors ${
                entry === page
                  ? "bg-brand-solid text-brand-on-solid"
                  : "border border-line bg-surface text-ink-700 hover:border-ink-300 hover:bg-ink-50"
              }`}
            >
              {entry}
            </Link>
          ),
        )}
      </div>

      {page < pageCount ? (
        <Link href={href(page + 1)} aria-label={labels.next} className="btn btn-outline btn-sm">
          <span className="hidden sm:inline">{labels.next}</span>
          <ChevronRightIcon size={15} />
        </Link>
      ) : (
        <span aria-disabled="true" className="btn btn-outline btn-sm pointer-events-none opacity-45">
          <span className="hidden sm:inline">{labels.next}</span>
          <ChevronRightIcon size={15} />
        </span>
      )}
    </nav>
  );
}
