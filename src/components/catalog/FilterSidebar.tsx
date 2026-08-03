"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { CheckIcon, CloseIcon, SpinnerIcon } from "@/components/ui/icons";
import { buildQuery, type CatalogFilters } from "@/lib/filters";

export type FilterCategory = {
  slug: string;
  nameKa: string;
  nameEn: string;
  icon: string;
  _count: { products: number };
};

type Props = {
  filters: CatalogFilters;
  categories: FilterCategory[];
  brands: string[];
  bounds: { min: number; max: number };
  /** Rendered inside the mobile drawer — closes it after a filter is applied. */
  onApplied?: () => void;
};

export function FilterSidebar({ filters, categories, brands, bounds, onApplied }: Props) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Price is the one filter that shouldn't navigate on every keystroke, so it
  // holds local state until submitted.
  const [minPrice, setMinPrice] = useState(filters.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice?.toString() ?? "");

  // Re-sync when the URL changes from elsewhere (chip removal, clear-all).
  // Adjusting during render rather than in an effect: React re-runs this
  // component immediately, without the extra commit-and-repaint pass.
  const urlRange = `${filters.minPrice ?? ""}|${filters.maxPrice ?? ""}`;
  const [lastRange, setLastRange] = useState(urlRange);

  if (lastRange !== urlRange) {
    setLastRange(urlRange);
    setMinPrice(filters.minPrice?.toString() ?? "");
    setMaxPrice(filters.maxPrice?.toString() ?? "");
  }

  function apply(overrides: Partial<CatalogFilters>) {
    startTransition(() => {
      router.push(`/catalog${buildQuery(filters, overrides)}`, { scroll: false });
      onApplied?.();
    });
  }

  function submitPrice(event: React.FormEvent) {
    event.preventDefault();
    const parse = (value: string) => {
      const parsed = Number(value);
      return value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    apply({ minPrice: parse(minPrice), maxPrice: parse(maxPrice) });
  }

  function toggleBrand(brand: string) {
    const next = filters.brands.includes(brand)
      ? filters.brands.filter((entry) => entry !== brand)
      : [...filters.brands, brand];
    apply({ brands: next });
  }

  const categoryName = (category: FilterCategory) =>
    locale === "ka" ? category.nameKa : category.nameEn;

  return (
    <div className={isPending ? "opacity-60 transition-opacity" : "transition-opacity"}>
      {/* ---------------------------- categories --------------------------- */}
      <FilterGroup title={t.catalog.category}>
        <ul className="flex flex-col gap-0.5">
          <li>
            <RadioRow
              label={t.catalog.allCategories}
              checked={filters.category === ""}
              onSelect={() => apply({ category: "" })}
            />
          </li>
          {categories.map((category) => (
            <li key={category.slug}>
              <RadioRow
                label={categoryName(category)}
                icon={category.icon}
                count={category._count.products}
                checked={filters.category === category.slug}
                onSelect={() => apply({ category: category.slug })}
              />
            </li>
          ))}
        </ul>
      </FilterGroup>

      {/* ------------------------------- price ----------------------------- */}
      <FilterGroup title={t.catalog.price}>
        <form onSubmit={submitPrice} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minPrice}
              onChange={(event) => setMinPrice(event.target.value)}
              placeholder={String(bounds.min)}
              aria-label={t.catalog.priceFrom}
              className="field h-9 px-2.5 text-sm"
            />
            <span className="text-ink-300">–</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxPrice}
              onChange={(event) => setMaxPrice(event.target.value)}
              placeholder={String(bounds.max)}
              aria-label={t.catalog.priceTo}
              className="field h-9 px-2.5 text-sm"
            />
          </div>
          <button type="submit" className="btn btn-outline btn-sm w-full">
            {t.catalog.apply}
          </button>
        </form>
      </FilterGroup>

      {/* ------------------------------ brands ----------------------------- */}
      {brands.length > 0 && (
        <FilterGroup title={t.catalog.brand}>
          <ul className="-mr-1 flex max-h-60 flex-col gap-0.5 overflow-y-auto pr-1">
            {brands.map((brand) => (
              <li key={brand}>
                <CheckboxRow
                  label={brand}
                  checked={filters.brands.includes(brand)}
                  onToggle={() => toggleBrand(brand)}
                />
              </li>
            ))}
          </ul>
        </FilterGroup>
      )}

      {/* --------------------------- availability -------------------------- */}
      <FilterGroup title={t.catalog.availability} last>
        <div className="flex flex-col gap-0.5">
          <CheckboxRow
            label={t.catalog.inStockOnly}
            checked={filters.inStock}
            onToggle={() => apply({ inStock: !filters.inStock })}
          />
          <CheckboxRow
            label={t.catalog.onSaleOnly}
            checked={filters.onSale}
            onToggle={() => apply({ onSale: !filters.onSale })}
          />
        </div>
      </FilterGroup>

      <button
        type="button"
        onClick={() =>
          startTransition(() => {
            // `q` survives a filter reset — clearing facets shouldn't throw
            // away what the shopper searched for.
            router.push(`/catalog${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ""}`, {
              scroll: false,
            });
            onApplied?.();
          })
        }
        className="btn btn-ghost btn-sm mt-4 w-full"
      >
        {isPending ? <SpinnerIcon size={15} /> : <CloseIcon size={15} />}
        {t.catalog.clear}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

function FilterGroup({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "py-4" : "border-b border-line py-4 first:pt-0"}>
      <h3 className="mb-2.5 text-xs font-bold tracking-wide text-ink-900">{title}</h3>
      {children}
    </section>
  );
}

function RadioRow({
  label,
  icon,
  count,
  checked,
  onSelect,
}: {
  label: string;
  icon?: string;
  count?: number;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs transition-colors ${
        checked ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-600 hover:bg-ink-50"
      }`}
    >
      {icon && (
        <span className="text-sm" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && (
        <span className="shrink-0 text-xs text-ink-400">{count}</span>
      )}
    </button>
  );
}

function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-ink-50">
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        aria-hidden="true"
        className={`grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors ${
          checked ? "border-brand-solid bg-brand-solid text-brand-on-solid" : "border-ink-300 bg-surface"
        }`}
      >
        {checked && <CheckIcon size={11} strokeWidth={3.5} />}
      </span>
      <span
        className={`flex-1 truncate text-xs ${
          checked ? "font-semibold text-ink-900" : "text-ink-600"
        }`}
      >
        {label}
      </span>
    </label>
  );
}
