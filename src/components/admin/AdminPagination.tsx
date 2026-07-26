import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";

/**
 * Simple prev/next pager for admin lists. Plain links, so it works without JS
 * and every page is a shareable URL.
 */
export function AdminPagination({
  basePath,
  params,
  page,
  pageCount,
  labels,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pageCount: number;
  labels: { previous: string; next: string; page: string };
}) {
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));

    const search = query.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <nav aria-label={labels.page} className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn btn-outline btn-sm">
          <ChevronLeftIcon size={15} />
          {labels.previous}
        </Link>
      ) : (
        <span className="btn btn-outline btn-sm pointer-events-none opacity-45">
          <ChevronLeftIcon size={15} />
          {labels.previous}
        </span>
      )}

      <span className="text-xs font-medium text-ink-500">
        {page} / {pageCount}
      </span>

      {page < pageCount ? (
        <Link href={href(page + 1)} className="btn btn-outline btn-sm">
          {labels.next}
          <ChevronRightIcon size={15} />
        </Link>
      ) : (
        <span className="btn btn-outline btn-sm pointer-events-none opacity-45">
          {labels.next}
          <ChevronRightIcon size={15} />
        </span>
      )}
    </nav>
  );
}
