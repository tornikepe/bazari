"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { Overlay } from "@/components/ui/Overlay";
import { CheckIcon, CloseIcon, SortIcon } from "@/components/ui/icons";
import { buildQuery, SORT_OPTIONS, type CatalogFilters, type Sort } from "@/lib/filters";

/**
 * How the catalogue is ordered — a native `<select>` on a desktop, a sheet on
 * a phone.
 *
 * The two are not a style preference. A `<select>` takes its minimum width
 * from its longest option, and WebKit keeps that as the element's scroll width
 * however much `min-w-0` it is given: "ფასი: დაბლიდან მაღლა" is wider than the
 * space left beside the filter button on every phone made. The control was
 * therefore given a whole row to itself, which spent a line of a small screen
 * saying "Newest first" — and on an iPhone SE it still overflowed by 15px.
 *
 * A button that opens the options is free of that: it is as wide as the word
 * "Sort", it sits beside the filter button on the same row, at the same
 * height, with a touch target the native control never had.
 */
export function SortSelect({ filters }: { filters: CatalogFilters }) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const labels: Record<Sort, string> = {
    newest: t.catalog.sortNewest,
    "price-asc": t.catalog.sortPriceAsc,
    "price-desc": t.catalog.sortPriceDesc,
    name: t.catalog.sortName,
  };

  const apply = (sort: Sort) => {
    setOpen(false);
    startTransition(() => {
      router.push(`/catalog${buildQuery(filters, { sort })}`, { scroll: false });
    });
  };

  return (
    <>
      {/* ------------------------------ phones -------------------------- */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        disabled={isPending}
        className="btn btn-outline btn-sm h-11 flex-1 sm:hidden"
      >
        <SortIcon size={15} />
        {t.catalog.sortAction}
      </button>

      <div className="sm:hidden">
        <Overlay
          open={open}
          onClose={() => setOpen(false)}
          side="bottom"
          closeLabel={t.nav.close}
          label={t.catalog.sortAction}
          className="border-t border-line bg-surface"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="text-base font-bold text-ink-900">{t.catalog.sortAction}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.nav.close}
              className="btn btn-ghost h-9 w-9 rounded-control p-0"
            >
              <CloseIcon size={19} />
            </button>
          </div>

          {/* A menu of one-choice rows rather than a list of links: choosing
              one is the whole interaction, and `aria-checked` is what says
              which is in force. */}
          <div role="radiogroup" aria-label={t.catalog.sortAction} className="p-2">
            {SORT_OPTIONS.map((option) => {
              const current = option === filters.sort;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={current}
                  onClick={() => apply(option)}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left text-sm ${
                    current ? "font-bold text-ink-900" : "text-ink-600"
                  }`}
                >
                  {labels[option]}
                  {current && <CheckIcon size={16} className="shrink-0 text-brand-600" />}
                </button>
              );
            })}
          </div>
        </Overlay>
      </div>

      {/* ------------------------------ desktop ------------------------- */}
      <label className="hidden min-w-0 items-center gap-2 sm:flex">
        <span className="shrink-0 text-xs text-ink-500">{t.catalog.sort}</span>
        <select
          value={filters.sort}
          disabled={isPending}
          onChange={(event) => apply(event.target.value as Sort)}
          className="field h-9 w-56 min-w-0 text-xs"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {labels[option]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
