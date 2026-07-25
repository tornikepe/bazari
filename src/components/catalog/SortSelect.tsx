"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { buildQuery, SORT_OPTIONS, type CatalogFilters, type Sort } from "@/lib/filters";

export function SortSelect({ filters }: { filters: CatalogFilters }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const labels: Record<Sort, string> = {
    newest: t.catalog.sortNewest,
    "price-asc": t.catalog.sortPriceAsc,
    "price-desc": t.catalog.sortPriceDesc,
    rating: t.catalog.sortRating,
    popular: t.catalog.sortPopular,
  };

  return (
    <label className="flex items-center gap-2">
      <span className="hidden shrink-0 text-xs text-ink-500 sm:inline">
        {t.catalog.sort}
      </span>
      <select
        value={filters.sort}
        disabled={isPending}
        onChange={(event) =>
          startTransition(() => {
            router.push(`/catalog${buildQuery(filters, { sort: event.target.value as Sort })}`, {
              scroll: false,
            });
          })
        }
        className="field h-9 w-auto min-w-[10.5rem] text-xs"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
