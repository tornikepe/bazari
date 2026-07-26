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
    name: t.catalog.sortName,
  };

  return (
    // `min-w-0` lets the select shrink below its intrinsic option width, which
    // is what pushed the row past a 320px viewport.
    <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
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
        className="field h-9 w-full min-w-0 text-xs sm:w-auto sm:min-w-[10.5rem]"
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
