import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { countText } from "@/lib/i18n";
import { parseFilters, type RawSearchParams } from "@/lib/filters";
import { getBrands, getCategoriesWithCounts, getFilteredProducts, getPriceBounds } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { PRODUCT_GRID } from "@/components/ui/ProductGridSkeleton";
import { FilterSidebar } from "@/components/catalog/FilterSidebar";
import { MobileFilterDrawer } from "@/components/catalog/MobileFilterDrawer";
import { ActiveFilterChips } from "@/components/catalog/ActiveFilterChips";
import { SortSelect } from "@/components/catalog/SortSelect";
import { Pagination } from "@/components/catalog/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { NoResultsArt } from "@/components/ui/illustrations";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const filters = parseFilters(await searchParams);

  const [{ items, total, page, pageCount }, categories, brands, bounds] = await Promise.all([
    getFilteredProducts(filters),
    getCategoriesWithCounts(),
    getBrands(filters),
    getPriceBounds(),
  ]);

  const activeCategory = categories.find((category) => category.slug === filters.category);

  return (
    <div className="page">
      {/* A way past the filters.
          The rail is 63 tab stops deep — a checkbox per category, per brand,
          plus the price range — and all of it sits between the top of the page
          and the first product. Reaching the thing you came for took 64 tab
          presses, on every catalogue page. That is the repeated block WCAG
          2.4.1 is about, and this is the mechanism it asks for.

          First inside <main>, ahead of the breadcrumb, so that the reader who
          takes "skip to content" from the header lands one Tab away from it.
          Hidden until focused, like that one, and for the same reason: a
          control nobody can see is not a control.

          In the flow rather than pinned to a corner like the header's. Pinned
          was tried first and is invisible here: `main` carries a filling
          animation, which gives it a stacking context, and inside one a
          `z-index` of 100 still paints under the sticky header. */}
      <a
        href="#results"
        className="sr-only focus:not-sr-only focus:mb-3 focus:inline-flex focus:min-h-11 focus:items-center focus:border focus:border-line focus:bg-surface focus:px-4 focus:text-sm focus:font-semibold focus:text-ink-900"
      >
        {t.catalog.skipFilters}
      </a>

      {/* A filtered category reads better with the category as the heading. */}
      <PageHeader
        crumbs={[{ label: t.nav.home, href: "/" }, { label: t.catalog.title }]}
        title={
          activeCategory
            ? locale === "ka"
              ? activeCategory.nameKa
              : activeCategory.nameEn
            : t.catalog.title
        }
      />

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* ----------------------------- sidebar ---------------------------- */}
        <aside className="hidden w-64 shrink-0 lg:block">
          {/* Its own scroll container. Sticky alone pins the rail to the top
              of the viewport and then lets it run off the bottom, so a long
              filter list could only be reached by scrolling the whole page
              past it first — and by then the rail had scrolled away too.
              Capped to the viewport minus the header, with the overflow
              handled here. */}
          <div className="sticky top-[var(--header-h)] card max-h-[calc(100dvh-var(--header-h)-1.5rem)] overflow-y-auto overscroll-contain card-pad-tight">
            <h2 className="mb-3 text-sm font-extrabold tracking-tight text-ink-900">
              {t.catalog.filters}
            </h2>
            <FilterSidebar
              filters={filters}
              categories={categories}
              brands={brands}
              bounds={bounds}
            />
          </div>
        </aside>

        {/* ------------------------------ results --------------------------- */}
        {/* `tabIndex={-1}`, or the skip link scrolls here and leaves focus
            behind in the rail — and the next Tab carries on through the
            filters as though nothing had happened. */}
        <section id="results" tabIndex={-1} className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              {countText(t.catalog.resultsCountOne, t.catalog.resultsCount, total)}
            </p>

            {/* Half the row each on a phone, their natural width from `sm` up.
                They used to wrap onto a line each — the sort control was a
                `<select>`, and a `<select>` cannot be narrower than its longest
                option: "ფასი: დაბლიდან მაღლა" is wider than the space beside
                the filter button on every phone made, and on an iPhone SE the
                row overflowed by 15px in WebKit. It is a button and a sheet
                now, so the two fit side by side at 320px. */}
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <MobileFilterDrawer
                filters={filters}
                categories={categories}
                brands={brands}
                bounds={bounds}
              />
              <SortSelect filters={filters} />
            </div>
          </div>

          <ActiveFilterChips filters={filters} categories={categories} />

          {items.length === 0 ? (
            <EmptyState
              className="card"
              art={<NoResultsArt size={88} />}
              title={t.catalog.noResults}
              text={t.catalog.noResultsHint}
              action={
                <Link href="/catalog" className="btn btn-primary btn-md">
                  {t.catalog.clear}
                </Link>
              }
            />
          ) : (
            <>
              <div className={`stagger ${PRODUCT_GRID}`}>
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              <Pagination
                filters={filters}
                page={page}
                pageCount={pageCount}
                labels={{
                  previous: t.common.previous,
                  next: t.common.next,
                  page: t.common.page,
                }}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
