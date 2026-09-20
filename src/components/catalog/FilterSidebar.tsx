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

  /** The deferred draft, sent — with whatever is in the price boxes, since
      the blur that would have written them and the press that sends them
      land in the same tick and the press would otherwise read the draft
      from before the blur. */
  function commit() {
    const final = { ...draft, minPrice: parse(minPrice), maxPrice: parse(maxPrice) };
    startTransition(() => {
      router.push(`/catalog${buildQuery(final)}`, { scroll: false });
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
          <div className="price-boxes">
            <PriceBox
              value={minPrice}
              placeholder={String(bounds.min)}
              label={t.catalog.priceFrom}
              onChange={setMinPrice}
              onBlur={() => deferred && submitPrice()}
            />
            <span className="text-ink-300" aria-hidden="true">
              —
            </span>
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

          {/* Enter in a box applies the price; the button for it is the
              one at the foot of the rail. */}
          <button type="submit" className="sr-only">
            {t.catalog.apply}
          </button>
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

      {/* The foot, on both: apply and reset. In the drawer apply sends the
          draft; in the rail, where everything else applies as it is
          touched, it sends the price boxes. Sticks to the bottom of the
          sheet while the groups above scroll. */}
      <div className="filter-foot">
        <button
          type="button"
          onClick={() => {
            if (deferred) {
              setDraft({ ...EMPTY_FILTERS, q: live.q });
              setMinPrice("");
              setMaxPrice("");
              return;
            }
            startTransition(() => {
              // `q` survives a filter reset — clearing facets shouldn't throw
              // away what the shopper searched for.
              router.push(`/catalog${live.q ? `?q=${encodeURIComponent(live.q)}` : ""}`, {
                scroll: false,
              });
              onApplied?.();
            });
          }}
          className="btn btn-outline btn-md"
        >
          {t.catalog.priceReset}
        </button>
        <button
          type="button"
          onClick={() => (deferred ? commit() : submitPrice())}
          disabled={isPending}
          className="btn btn-primary btn-md flex-1"
        >
          {isPending ? <SpinnerIcon size={15} /> : null}
          {t.catalog.apply}
        </button>
      </div>
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
        <span className="text-sm font-bold text-ink-900">{title}</span>
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
  /* A small box with its label over it in small capitals and the lari
     sign inside at the right; the two sit centred with a dash between. */
  return (
    <label className="price-box">
      <span className="eyebrow">{label}</span>
      <span className="relative block">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className="field h-10 w-full pr-7 pl-3 text-center text-sm font-semibold tabular-nums"
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-ink-400">
          ₾
        </span>
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
    /* A row: the icon, the name, and the count at the far right as a plain
       figure. The chosen one is black with paper type, the way the site's
       primary button is — one row lit, the rest quiet. */
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={`filter-row ${checked ? "is-on" : ""}`}
    >
      {icon && (
        <span className="filter-row-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {/* Wraps rather than truncates: "ტელეფონები და აქსესუარები" cut to
          "ტელეფონები და აქსესუ…" is a category nobody can read. */}
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
      {typeof count === "number" && <span className="filter-row-count">{count}</span>}
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
    <label className={`filter-row cursor-pointer ${checked ? "is-on" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        aria-hidden="true"
        className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border transition-colors ${
          checked ? "border-surface bg-surface text-ink-900" : "border-ink-300 bg-surface"
        }`}
      >
        {checked && <CheckIcon size={11} strokeWidth={3.5} />}
      </span>
      <span className="flex-1 truncate">{label}</span>
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
    <label className="filter-row cursor-pointer justify-between">
      <span className={checked ? "font-semibold text-ink-900" : ""}>{label}</span>
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
