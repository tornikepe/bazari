import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { productCardSelect } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { PRODUCT_GRID_WIDE } from "@/components/ui/ProductGridSkeleton";
import { JsonLd } from "@/components/seo/JsonLd";
import { BrandCube } from "@/components/home/BrandCube";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import {
  ArrowRightIcon,
  PackageIcon,
  RefreshIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/ui/icons";

export default async function HomePage() {
  const { locale, t } = await getI18n();

  const [categories, featured, newArrivals, productCount, brands] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }],
      include: { _count: { select: { products: { where: { isActive: true } } } } },
    }),
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      select: productCardSelect,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: productCardSelect,
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    prisma.product.count({ where: { isActive: true } }),
    // Every hero stat is a real count from the database — nothing invented.
    prisma.product.findMany({
      where: { isActive: true, brand: { not: "" } },
      distinct: ["brand"],
      select: { brand: true },
    }),
  ]);

  const name = (row: { nameKa: string; nameEn: string }) =>
    locale === "ka" ? row.nameKa : row.nameEn;

  const perks = [
    { icon: ShieldIcon, title: t.home.why1Title, text: t.home.why1Text },
    { icon: PackageIcon, title: t.home.why2Title, text: t.home.why2Text },
    { icon: RefreshIcon, title: t.home.why3Title, text: t.home.why3Text },
    { icon: TruckIcon, title: t.home.why4Title, text: t.home.why4Text },
  ];

  /*
   * Organization and WebSite markup.
   *
   * Everything here is a fact the site can back: the name, the URL, and a
   * search endpoint that genuinely exists and genuinely works. There is no
   * `address`, `telephone`, `logo` or `sameAs` — the shop has no registered
   * address or phone number, and inventing one in markup that search engines
   * read as a business record is worse than omitting it.
   *
   * `SearchAction` is real: /catalog?q= is the search this site actually uses.
   */
  const organisationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: t.home.heroSubtitle,
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: [locale === "ka" ? "ka-GE" : "en", locale === "ka" ? "en" : "ka-GE"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/catalog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <JsonLd data={organisationSchema} />
      <JsonLd data={websiteSchema} />

      {/* ------------------------------- hero ------------------------------ */}
      {/*
        Built on the grid rather than on a background. The old hero leaned on
        two blurred orbs, a masked grid and a sheen sweeping the headline —
        effects doing the work that structure should do. What carries this one
        is the rule set behind it, the alignment, and one line of red.
      */}
      <section className="grid-field border-b border-line bg-surface">
        <div className="page-container relative py-14 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-7">
              <p className="label">{t.home.heroBadge}</p>

              <h1 className="display mt-5 max-w-2xl text-ink-900">{t.home.heroTitle}</h1>

              <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-600">
                {t.home.heroSubtitle}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/catalog" className="btn btn-primary btn-lg w-full sm:w-auto">
                  {t.home.heroCta}
                  <ArrowRightIcon size={17} />
                </Link>
                <Link href="/about" className="btn btn-outline btn-lg w-full sm:w-auto">
                  {t.home.heroSecondary}
                </Link>
              </div>
            </div>

            {/*
              The counts, set as figures against the rules. Every one is
              counted from the database — the shop has exactly this many
              products, categories and brands, and nothing here is rounded up
              to look better.
            */}
            {/* The object sits in the column the grid already left empty,
                above the figures rather than beside the headline — the words
                keep the reading position and this keeps the space that was
                doing nothing. */}
            <div className="lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:self-start">
              <BrandCube />
            </div>

            <dl className="lg:col-span-4 lg:col-start-9 lg:self-end">
              {[
                { value: String(productCount), label: t.home.statProducts },
                { value: String(categories.length), label: t.home.statCategories },
                { value: String(brands.length), label: t.home.statBrands },
              ].map((stat, index) => (
                <div
                  key={stat.label}
                  className={`flex items-baseline justify-between gap-4 border-line py-4 ${
                    index === 0 ? "border-t" : "border-t"
                  } ${index === 2 ? "border-b" : ""}`}
                >
                  <dt className="label">{stat.label}</dt>
                  <dd className="figure text-ink-900">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* --------------------------- category index ------------------------ */}
      {/*
        A numbered index rather than a wall of tiles. It reads top to bottom
        like a contents page, the counts line up in their own column because
        the figures are tabular, and it costs no images — which matters while
        every product still shares one placeholder.
      */}
      <section className="page-container py-12 lg:py-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="label">{t.home.shopByCategory}</h2>
          <Link
            href="/catalog"
            className="text-xs font-bold text-brand-600 underline underline-offset-4"
          >
            {t.home.viewAll}
          </Link>
        </div>

        <div className="index-list mt-5">
          {categories.map((category, index) => (
            <Link
              key={category.slug}
              href={`/catalog?category=${category.slug}`}
              className="index-row"
            >
              <span className="index-num">{String(index + 1).padStart(2, "0")}</span>
              <span className="index-name">{name(category)}</span>
              <span className="index-count">{category._count.products}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------ featured --------------------------- */}
      {featured.length > 0 && (
        <section className="page-container rule pt-12 pb-12 lg:pt-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="label">{t.home.featured}</h2>
            <Link
              href="/catalog"
              className="text-xs font-bold text-brand-600 underline underline-offset-4"
            >
              {t.home.viewAll}
            </Link>
          </div>
          <p className="mt-1.5 text-sm text-ink-500">{t.home.featuredHint}</p>

          <div className={`mt-6 ${PRODUCT_GRID_WIDE}`}>
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------- deals banner ------------------------- */}
      {/*
        The one place the red is allowed to fill a whole region. Flat, square
        and left-aligned — the gradient wash that used to sit on top of it was
        decoration standing in for hierarchy.
      */}
      <section className="page-container pb-12 lg:pb-16">
        <div className="flex flex-col justify-between gap-6 bg-brand-solid px-6 py-10 text-brand-on-solid sm:flex-row sm:items-end sm:px-10">
          <div>
            <p className="label text-brand-on-solid opacity-80">{t.nav.deals}</p>
            <h2 className="mt-3 max-w-lg text-2xl leading-tight font-extrabold tracking-tight">
              {t.home.dealsTitle}
            </h2>
            <p className="mt-2 max-w-md text-sm opacity-90">{t.home.dealsText}</p>
          </div>

          <Link
            href="/catalog?sale=1"
            className="btn btn-lg shrink-0 bg-surface text-ink-900 hover:bg-ink-100"
          >
            {t.home.viewAll}
            <ArrowRightIcon size={17} />
          </Link>
        </div>
      </section>

      {/* ---------------------------- new arrivals ------------------------- */}
      {newArrivals.length > 0 && (
        // Named so the screenshot suite can paint over it: these four cards
        // are whatever was added last, and the suite adds products.
        <section id="new-arrivals" className="page-container rule py-12 lg:py-16">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="label">{t.home.newArrivals}</h2>
            <Link
              href="/catalog"
              className="text-xs font-bold text-brand-600 underline underline-offset-4"
            >
              {t.home.viewAll}
            </Link>
          </div>
          <p className="mt-1.5 text-sm text-ink-500">{t.home.newArrivalsHint}</p>

          {/* A one-pixel gap over a line-coloured background: the cards are
              separated by the same rule that runs everywhere else, rather
              than by floating apart on shadows. */}
          <div className={`mt-6 ${PRODUCT_GRID_WIDE}`}>
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------- why ------------------------------ */}
      <section className="border-t border-line bg-surface">
        <div className="page-container py-12 lg:py-16">
          <h2 className="label">{t.home.whyTitle}</h2>

          <div className="mt-6 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {perks.map((perk) => (
              <div key={perk.title} className="bg-surface p-5 lg:p-6">
                <perk.icon size={20} className="text-brand-600" />
                <h3 className="mt-4 text-sm font-bold text-ink-900">{perk.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{perk.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
