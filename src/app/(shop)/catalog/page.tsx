import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { parseFilters, type RawSearchParams } from "@/lib/filters";
import { getBrands, getCategoriesWithCounts, getFilteredProducts, getPriceBounds } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { PRODUCT_GRID } from "@/components/ui/ProductGridSkeleton";
import { FilterSidebar } from "@/components/catalog/FilterSidebar";
import { MobileFilterDrawer } from "@/components/catalog/MobileFilterDrawer";
import { ActiveFilterChips } from "@/components/catalog/ActiveFilterChips";
import { SortSelect } from "@/components/catalog/SortSelect";
import { Pagination } from "@/components/catalog/Pagination";
import { PackageIcon } from "@/components/ui/icons";

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
    <div className="page-container py-6 lg:py-8">
      {/* breadcrumb + title */}
      <nav aria-label="breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-ink-400">
        <Link href="/" className="transition-colors hover:text-brand-600">
          {t.nav.home}
        </Link>
        <span>/</span>
        <span className="text-ink-600">{t.catalog.title}</span>
      </nav>

      {/* A filtered category reads better with the category as the heading. */}
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
        {activeCategory
          ? locale === "ka"
            ? activeCategory.nameKa
            : activeCategory.nameEn
          : t.catalog.title}
      </h1>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* ----------------------------- sidebar ---------------------------- */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-[var(--header-h)] card p-4">
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
        <section className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              {fill(t.catalog.resultsCount, { count: total })}
            </p>

            <div className="flex items-center gap-2">
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
            <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-pill bg-ink-100 text-ink-400">
                <PackageIcon size={26} />
              </span>
              <h2 className="text-base font-bold text-ink-900">{t.catalog.noResults}</h2>
              <p className="max-w-sm text-sm text-ink-500">{t.catalog.noResultsHint}</p>
              <Link href="/catalog" className="btn btn-primary btn-sm mt-1">
                {t.catalog.clear}
              </Link>
            </div>
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
