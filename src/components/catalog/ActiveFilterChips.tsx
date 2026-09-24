"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { CloseIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import { buildQuery, hasActiveFilters, type CatalogFilters } from "@/lib/filters";
import type { FilterCategory } from "@/components/catalog/FilterSidebar";

/** Removable summary of every active facet, so nothing filters invisibly. */
export function ActiveFilterChips({
  filters,
  categories,
  bounds,
}: {
  filters: CatalogFilters;
  categories: FilterCategory[];
  /** The cheapest and dearest in the catalogue, in lari. */
  bounds: { min: number; max: number };
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (!hasActiveFilters(filters)) return null;

  function remove(overrides: Partial<CatalogFilters>) {
    startTransition(() => {
      router.push(`/catalog${buildQuery(filters, overrides)}`, { scroll: false });
    });
  }

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (filters.q) {
    chips.push({
      key: "q",
      label: `${t.catalog.searchResultsFor} ${filters.q}`,
      onRemove: () => remove({ q: "" }),
    });
  }

  if (filters.category) {
    const category = categories.find((entry) => entry.slug === filters.category);
    if (category) {
      chips.push({
        key: "category",
        label: locale === "ka" ? category.nameKa : category.nameEn,
        onRemove: () => remove({ category: "" }),
      });
    }
  }

  for (const brand of filters.brands) {
    chips.push({
      key: `brand-${brand}`,
      label: brand,
      onRemove: () => remove({ brands: filters.brands.filter((entry) => entry !== brand) }),
    });
  }

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    /* The filters hold lari, `formatPrice` takes tetri: a chip for
       "22–100 ₾" read "0,22 ₾ – 1,00 ₾" until the two were reconciled.
       An end left open reads as the catalogue's own edge — "22 ₾ – 100 ₾"
       when only the top was set — rather than as an ellipsis. */
    const from = formatPrice((filters.minPrice ?? bounds.min) * 100, locale);
    const to = formatPrice((filters.maxPrice ?? bounds.max) * 100, locale);
    chips.push({
      key: "price",
      label: `${from} – ${to}`,
      onRemove: () => remove({ minPrice: null, maxPrice: null }),
    });
  }

  if (filters.inStock) {
    chips.push({
      key: "stock",
      label: t.catalog.inStockOnly,
      onRemove: () => remove({ inStock: false }),
    });
  }

  if (filters.onSale) {
    chips.push({
      key: "sale",
      label: t.catalog.onSaleOnly,
      onRemove: () => remove({ onSale: false }),
    });
  }

  /* A row of black pills, each with a cross that turns red under the
     pointer. No "clear all" here: the filters' own foot has one, and two
     of them two inches apart was a choice about which to press.

     On a phone the heading sits on its own line above the pills and the
     pills are centred under it, since a label and four pills on one
     wrapping row left a ragged block with the heading stranded. */
  return (
    <div className="active-filters">
      <span className="eyebrow">{t.catalog.activeFilters}</span>

      <div className="active-filters-row">
        {chips.map((chip) => (
          <button key={chip.key} type="button" onClick={chip.onRemove} className="filter-chip">
            <span className="max-w-[12rem] truncate">{chip.label}</span>
            <CloseIcon size={13} strokeWidth={2.5} />
          </button>
        ))}
      </div>
    </div>
  );
}
