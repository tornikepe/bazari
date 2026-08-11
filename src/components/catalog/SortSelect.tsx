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
    // `min-w-0` lets the select shrink below its intrinsic option width — in
    // Chromium. WebKit sizes a `<select>`'s min-content from its longest option
    // and keeps that as the element's scroll width whatever it is laid out at,
    // so on a 320px screen in Georgian ("ფასი: დაბლიდან მაღლა") the row could
    // still be dragged sideways by 15px. Chromium measured it as fine, which is
    // why it took running the suite on WebKit to see it at all.
    //
    // `w-full` below `sm` takes the whole row instead of sharing it with the
    // filter button, which gives the select the width its longest option wants.
    // It needs the parent's `flex-wrap` to have anywhere to go.
    <label className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-none">
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
        className="field h-9 w-full min-w-0 text-xs sm:w-56"
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
