"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { FilterSidebar, type FilterCategory } from "@/components/catalog/FilterSidebar";
import { Overlay } from "@/components/ui/Overlay";
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
          <span className="grid h-4 min-w-4 place-items-center rounded-pill bg-brand-solid px-1 text-xs font-bold text-brand-on-solid">
            {activeCount}
          </span>
        )}
      </button>

      <div className="lg:hidden">
        <Overlay
          open={open}
          onClose={() => setOpen(false)}
          side="bottom"
          closeLabel={t.nav.close}
          className="max-h-[85vh] border-t border-line bg-surface"
        >
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
        </Overlay>
      </div>
    </>
  );
}
