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
}: {
  filters: CatalogFilters;
  categories: FilterCategory[];
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
    const from = filters.minPrice !== null ? formatPrice(filters.minPrice, locale) : "…";
    const to = filters.maxPrice !== null ? formatPrice(filters.maxPrice, locale) : "…";
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

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-ink-500">{t.catalog.activeFilters}:</span>

      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="badge group border border-line bg-surface text-ink-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          <span className="max-w-[14rem] truncate">{chip.label}</span>
          <CloseIcon size={12} className="text-ink-400 group-hover:text-brand-600" />
        </button>
      ))}

      <button
        type="button"
        onClick={() => remove({ ...filters, q: "", category: "", brands: [], minPrice: null, maxPrice: null, inStock: false, onSale: false })}
        className="text-xs font-semibold text-brand-600 underline-offset-2 hover:underline"
      >
        {t.catalog.clear}
      </button>
    </div>
  );
}
