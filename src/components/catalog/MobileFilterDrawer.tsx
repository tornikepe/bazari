"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { FilterSidebar, type FilterCategory } from "@/components/catalog/FilterSidebar";
import { CloseIcon, FilterIcon } from "@/components/ui/icons";
import { countActiveFilters, type CatalogFilters } from "@/lib/filters";

/** The sidebar, as a bottom-anchored drawer below the `lg` breakpoint. */
export function MobileFilterDrawer({
  filters,
  categories,
  brands,
  bounds,
}: {
  filters: CatalogFilters;
  categories: FilterCategory[];
  brands: string[];
  bounds: { min: number; max: number };
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-outline btn-sm lg:hidden"
        aria-expanded={open}
      >
        <FilterIcon size={15} />
        {t.catalog.filters}
        {activeCount > 0 && (
          <span className="grid h-4 min-w-4 place-items-center rounded-pill bg-brand-600 px-1 text-xs font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t.nav.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
          />

          <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-card bg-surface shadow-pop">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 className="text-base font-bold text-ink-900">{t.catalog.filters}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.nav.close}
                className="btn btn-ghost h-9 w-9 rounded-control p-0"
              >
                <CloseIcon size={19} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <FilterSidebar
                filters={filters}
                categories={categories}
                brands={brands}
                bounds={bounds}
                onApplied={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
