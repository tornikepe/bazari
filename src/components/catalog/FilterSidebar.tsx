"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { CheckIcon, ChevronDownIcon, CloseIcon, SearchIcon, SpinnerIcon } from "@/components/ui/icons";
import { buildQuery, EMPTY_FILTERS, type CatalogFilters } from "@/lib/filters";
import { fill } from "@/lib/i18n";

/** Brands shown before "more". */
const BRANDS_SHOWN = 8;

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
  /**
   * Hold every change until the button at the foot is pressed. The drawer
   * on a phone: applying on each tap re-fetched the page under the sheet
   * and, with the sheet closing on each, made choosing a brand and a price
   * three trips. The rail on a desktop applies as it is touched.
   */
  deferred?: boolean;
};

/**
 * The filters: category, price, brand, availability.
 *
 * Four groups that fold, each with what it holds in its heading — "2
 * chosen" beside brand — so a folded group still says what it is doing.
 * Price is a pair of boxes and a two-thumb range under them that move
 * together; brand has a search box once there are more than a handful,
 * since thirty-six checkboxes are not a list anyone reads. Availability
 * is two switches rather than two checkboxes, because each is a state
 * of the whole catalogue and not a member of a set.
 */
export function FilterSidebar({ filters: live, categories, brands, bounds, onApplied, deferred = false }: Props) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /* Deferred: the choices collect in a draft and go to the address in one
     push. The draft follows the address whenever that changes elsewhere. */
  const [draft, setDraft] = useState<CatalogFilters>(live);
  const liveKey = JSON.stringify(live);
  const [lastLive, setLastLive] = useState(liveKey);
  if (lastLive !== liveKey) {
    setLastLive(liveKey);
    setDraft(live);
  }
  const filters = deferred ? draft : live;

  // Price is the one filter that shouldn't navigate on every keystroke, so it
  // holds local state until submitted.
  const [minPrice, setMinPrice] = useState(filters.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice?.toString() ?? "");
  const [allBrands, setAllBrands] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");

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
    if (deferred) {
      setDraft((current) => ({ ...current, ...overrides }));
      return;
    }
    startTransition(() => {
      router.push(`/catalog${buildQuery(filters, overrides)}`, { scroll: false });
      onApplied?.();
    });
  }

  /** The deferred draft, sent. */
  function commit() {
    startTransition(() => {
      router.push(`/catalog${buildQuery(draft)}`, { scroll: false });
      onApplied?.();
    });
  }

  const parse = (value: string) => {
    const parsed = Number(value);
    return value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  function submitPrice(event?: React.FormEvent) {
    event?.preventDefault();
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

  /* The slider's two thumbs. Each is a native range input laid over the
     other; the lower one may not pass the upper and the reverse. */
  const span = Math.max(1, bounds.max - bounds.min);
  const lo = Math.min(Math.max(parse(minPrice) ?? bounds.min, bounds.min), bounds.max);
  const hi = Math.min(Math.max(parse(maxPrice) ?? bounds.max, bounds.min), bounds.max);
  const pct = (value: number) => `${((value - bounds.min) / span) * 100}%`;

  const shownBrands = (
    brandQuery.trim()
      ? brands.filter((brand) => brand.toLowerCase().includes(brandQuery.trim().toLowerCase()))
      : allBrands
        ? brands
        : brands.filter((brand, index) => index < BRANDS_SHOWN || filters.brands.includes(brand))
  );

  const priceActive = filters.minPrice !== null || filters.maxPrice !== null;
  const availabilityActive = Number(filters.inStock) + Number(filters.onSale);

  return (
    <div className={`filter-rail ${isPending ? "opacity-60 transition-opacity" : "transition-opacity"}`}>
      {/* ---------------------------- categories --------------------------- */}
      <FilterGroup
        title={t.catalog.category}
        badge={filters.category ? categoryName(categories.find((c) => c.slug === filters.category) ?? categories[0]!) : undefined}
      >
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
      <FilterGroup
        title={t.catalog.price}
        badge={priceActive ? `${filters.minPrice ?? bounds.min}–${filters.maxPrice ?? bounds.max} ₾` : undefined}
      >
        <form onSubmit={submitPrice} className="flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <PriceBox
              value={minPrice}
              placeholder={String(bounds.min)}
              label={t.catalog.priceFrom}
              onChange={setMinPrice}
              onBlur={() => deferred && submitPrice()}
            />
            <span className="text-ink-300">–</span>
            <PriceBox
              value={maxPrice}
              placeholder={String(bounds.max)}
              label={t.catalog.priceTo}
              onChange={setMaxPrice}
              onBlur={() => deferred && submitPrice()}
            />
          </div>

          <div
            className="price-range"
            style={{ "--lo": pct(lo), "--hi": pct(hi) } as React.CSSProperties}
          >
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              value={lo}
              aria-label={t.catalog.priceFrom}
              onChange={(event) => setMinPrice(String(Math.min(Number(event.target.value), hi)))}
              onPointerUp={() => submitPrice()}
              onKeyUp={(event) => (event.key === "ArrowLeft" || event.key === "ArrowRight") && submitPrice()}
            />
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              value={hi}
              aria-label={t.catalog.priceTo}
              onChange={(event) => setMaxPrice(String(Math.max(Number(event.target.value), lo)))}
              onPointerUp={() => submitPrice()}
              onKeyUp={(event) => (event.key === "ArrowLeft" || event.key === "ArrowRight") && submitPrice()}
            />
          </div>

          {/* In the drawer the price goes with everything else, from the
              button at the foot; the rail applies it here. */}
          {!deferred && (
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button type="submit" className="btn btn-outline btn-sm">
                {t.catalog.apply}
              </button>
              {priceActive && (
                <button
                  type="button"
                  onClick={() => apply({ minPrice: null, maxPrice: null })}
                  className="btn btn-ghost btn-sm"
                >
                  {t.catalog.priceReset}
                </button>
              )}
            </div>
          )}
        </form>
      </FilterGroup>

      {/* ------------------------------ brands ----------------------------- */}
      {brands.length > 0 && (
        <FilterGroup
          title={t.catalog.brand}
          badge={filters.brands.length > 0 ? fill(t.catalog.activeCount, { count: filters.brands.length }) : undefined}
        >
          {brands.length > BRANDS_SHOWN && (
            <label className="relative mb-2 block">
              <SearchIcon
                size={14}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400"
              />
              <input
                type="search"
                value={brandQuery}
                onChange={(event) => setBrandQuery(event.target.value)}
                placeholder={t.catalog.brandSearch}
                aria-label={t.catalog.brandSearch}
                className="field h-9 pl-8 text-xs"
              />
            </label>
          )}

          {/* No `max-h` and no scroll of its own. The rail around this is
              already a scroll container, and a scrollbar inside a scrollbar
              is the worst of both. One scroller, the outer one. */}
          <ul className="flex flex-col gap-0.5">
            {shownBrands.map((brand) => (
              <li key={brand}>
                <CheckboxRow
                  label={brand}
                  checked={filters.brands.includes(brand)}
                  onToggle={() => toggleBrand(brand)}
                />
              </li>
            ))}
            {shownBrands.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-ink-400">{t.catalog.brandNone}</li>
            )}
          </ul>
          {!brandQuery.trim() && brands.length > BRANDS_SHOWN && (
            <button
              type="button"
              onClick={() => setAllBrands((current) => !current)}
              aria-expanded={allBrands}
              className="mt-1.5 px-2 text-xs font-semibold text-brand-600 hover:underline"
            >
              {allBrands
                ? t.catalog.brandsFewer
                : fill(t.catalog.brandsMore, { count: brands.length - BRANDS_SHOWN })}
            </button>
          )}
        </FilterGroup>
      )}

      {/* --------------------------- availability -------------------------- */}
      <FilterGroup
        title={t.catalog.availability}
        badge={availabilityActive ? fill(t.catalog.activeCount, { count: availabilityActive }) : undefined}
        last
      >
        <div className="flex flex-col gap-1">
          <SwitchRow
            label={t.catalog.inStockOnly}
            checked={filters.inStock}
            onToggle={() => apply({ inStock: !filters.inStock })}
          />
          <SwitchRow
            label={t.catalog.onSaleOnly}
            checked={filters.onSale}
            onToggle={() => apply({ onSale: !filters.onSale })}
          />
        </div>
      </FilterGroup>

      {deferred ? (
        /* The foot of the drawer: apply, and clear beside it. Sticks to
           the bottom of the sheet while the groups above scroll. */
        <div className="filter-foot">
          <button
            type="button"
            onClick={() => setDraft({ ...EMPTY_FILTERS, q: live.q })}
            className="btn btn-ghost btn-md"
          >
            <CloseIcon size={15} />
            {t.catalog.clear}
          </button>
          <button type="button" onClick={commit} disabled={isPending} className="btn btn-primary btn-md flex-1">
            {isPending ? <SpinnerIcon size={15} /> : null}
            {t.catalog.apply}
          </button>
        </div>
      ) : (
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
          className="btn btn-ghost btn-sm mt-3 w-full"
        >
          {isPending ? <SpinnerIcon size={15} /> : <CloseIcon size={15} />}
          {t.catalog.clear}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

/** A group that folds, with what it holds said in its heading while folded. */
function FilterGroup({
  title,
  badge,
  children,
  last = false,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const id = useId();

  return (
    <section className={last ? "py-3" : "border-b border-line py-3 first:pt-0"}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="flex min-h-9 w-full items-center gap-2 text-left"
      >
        <span className="text-xs font-bold tracking-wide text-ink-900">{title}</span>
        {badge && (
          <span className="badge max-w-[10rem] truncate bg-brand-50 text-[11px] text-brand-700">
            {badge}
          </span>
        )}
        <ChevronDownIcon
          size={15}
          className={`ml-auto shrink-0 text-ink-400 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      <div id={id} className="menu-fold" data-folded={!open}>
        <div className="menu-fold-inner">
          <div className="pt-1.5">{children}</div>
        </div>
      </div>
    </section>
  );
}

function PriceBox({
  value,
  placeholder,
  label,
  onChange,
  onBlur,
}: {
  value: string;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <label className="relative block">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-label={label}
        className="field h-9 pr-6 pl-2.5 text-sm tabular-nums"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-ink-400">
        ₾
      </span>
    </label>
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
      className={`flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left text-xs transition-colors ${
        checked ? "bg-brand-50 font-semibold text-brand-700" : "text-ink-600 hover:bg-ink-50"
      }`}
    >
      {icon && (
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-control text-sm ${
            checked ? "bg-surface" : "bg-ink-50"
          }`}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      {/* Wraps rather than truncates: "ტელეფონები და აქსესუარები" cut to
          "ტელეფონები და აქსესუ…" is a category nobody can read. */}
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
      {typeof count === "number" && (
        <span
          className={`shrink-0 rounded-pill px-1.5 py-0.5 text-[11px] tabular-nums ${
            checked ? "bg-surface text-brand-700" : "bg-ink-100 text-ink-500"
          }`}
        >
          {count}
        </span>
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
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border transition-colors ${
          checked ? "border-brand-solid bg-brand-solid text-brand-on-solid" : "border-ink-300 bg-surface"
        }`}
      >
        {checked && <CheckIcon size={11} strokeWidth={3.5} />}
      </span>
      <span className={`flex-1 truncate text-xs ${checked ? "font-semibold text-ink-900" : "text-ink-600"}`}>
        {label}
      </span>
    </label>
  );
}

/** A switch: on or off, for a state of the whole list. */
function SwitchRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-control px-2 py-1.5 transition-colors hover:bg-ink-50">
      <span className={`text-xs ${checked ? "font-semibold text-ink-900" : "text-ink-600"}`}>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors ${
          checked ? "bg-brand-solid" : "bg-ink-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-pill bg-surface shadow-sm transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </label>
  );
}
