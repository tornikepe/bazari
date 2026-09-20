import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { fill } from "@/lib/i18n";
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
  BagCheckIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { SectionLink } from "@/components/ui/SectionLink";
import { SplitWords } from "@/components/editorial/SplitWords";
import { Rail } from "@/components/editorial/Rail";
import Image from "next/image";


export default async function HomePage() {
  const { locale, t } = await getI18n();

  const [categories, featured, newArrivals, productCount, brands] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }],
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
        /* One picture for the tile. Real photographs sort before the
           placeholder because their path does ("/api/…" before
           "/products/…"), so a category with any of its own comes up with
           one of its own, and the rest show the sample picture. */
        products: {
          where: { isActive: true },
          orderBy: [{ image: "asc" }, { isFeatured: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { image: true },
        },
      },
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
    { icon: BagCheckIcon, title: t.home.why1Title, text: t.home.why1Text },
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
      {/* The whole first screen: the headline in the serif, set large and
          low, the object standing in the brand's light at the right, and a
          line of the shop's promises running under it all. */}
      <section className="hero-editorial border-b border-line">
        <div className="page-container relative grid gap-10 pt-10 pb-12 lg:grid-cols-12 lg:gap-8 lg:pt-16 lg:pb-16">
          <div className="lg:col-span-8">
            <p className="eyebrow">{t.home.heroBadge}</p>
            <h1 className="display-xl mt-6 max-w-[14ch] text-ink-900">
              <SplitWords text={t.home.heroTitle} />
            </h1>
            <p className="reveal mt-8 max-w-md text-base leading-relaxed text-ink-600 lg:text-lg">
              {t.home.heroSubtitle}
            </p>
            <div className="reveal mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/catalog" className="btn btn-primary btn-lg w-full sm:w-auto">
                {t.home.heroCta}
                <ArrowRightIcon size={17} />
              </Link>
              <Link href="/about" className="btn btn-outline btn-lg w-full sm:w-auto">
                {t.home.heroSecondary}
              </Link>
            </div>
          </div>

          {/* The counts, under the object, each a real figure from the
              database and none rounded up to look better. */}
          <div className="lg:col-span-4 lg:flex lg:flex-col lg:items-end lg:justify-between">
            <div className="parallax-back mx-auto w-56 lg:mx-0 lg:w-64">
              <BrandCube />
            </div>
            <dl className="mt-8 grid grid-cols-3 gap-4 lg:mt-0 lg:w-full">
              {[
                { value: String(productCount), label: t.home.statProducts },
                { value: String(categories.length), label: t.home.statCategories },
                { value: String(brands.length), label: t.home.statBrands },
              ].map((stat) => (
                <div key={stat.label} className="border-t border-ink-900 pt-3">
                  <dd className="display-md text-ink-900 tabular-nums">{stat.value}</dd>
                  <dt className="eyebrow mt-1">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>

      </section>

      {/* --------------------------- categories ---------------------------- */}
      {/* A strip of tall tiles that scrolls sideways: a number, the name
          in the serif, the count, and the icon standing in the corner. */}
      <section className="page-container pt-12 lg:pt-16">
        <div className="section-head reveal">
          <div>
            <p className="eyebrow">{t.home.shopByCategory}</p>
            <h2 className="display-md mt-2 text-ink-900">{t.home.shopByCategoryHint}</h2>
          </div>
          <SectionLink href="/catalog">{t.home.viewAll}</SectionLink>
        </div>

        <div className="cat-strip mt-8">
          {categories.map((category, index) => (
            <Link
              key={category.slug}
              href={`/catalog?category=${category.slug}`}
              className="cat-tile reveal"
            >
              {/* The tile is a photograph of something in the category —
                  a shoe for the shoes — with the words set over its foot. */}
              <Image
                src={category.products[0]?.image ?? "/products/placeholder.svg"}
                alt=""
                fill
                sizes="(max-width: 640px) 60vw, 300px"
                className="cat-photo"
              />
              <span className="cat-veil" aria-hidden="true" />
              <span className="relative flex items-start justify-between">
                <span className="label text-white/80">{String(index + 1).padStart(2, "0")}</span>
                <span className="cat-icon" aria-hidden="true">
                  {category.icon}
                </span>
              </span>
              <span className="relative">
                <span className="cat-name block text-balance text-white">{name(category)}</span>
                <span className="label mt-2 block text-white/75">
                  {category._count.products === 1
                    ? t.home.indexCountOne
                    : fill(t.home.indexCount, { count: category._count.products })}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------ featured --------------------------- */}
      {/* An editorial grid: the first product large, the rest beside and
          under it. */}
      {featured.length > 0 && (
        <section className="page-container pt-14 lg:pt-20">
          {/* The arrows sit at the right of this head — the rail draws
              them there — so the head keeps only the words. */}
          <div className="section-head reveal pr-24">
            <div>
              <p className="eyebrow">{t.home.featured}</p>
              <h2 className="display-md mt-2 text-ink-900">{t.home.featuredHint}</h2>
            </div>
          </div>

          <Rail className="mt-8" label={{ previous: t.common.previous, next: t.common.next }}>
            {featured.map((product, index) => (
              <div key={product.id} className="rail-item">
                <ProductCard product={product} priority={index < 3} />
              </div>
            ))}
          </Rail>

          <div className="mt-8 flex justify-center">
            <Link href="/catalog" className="btn btn-outline btn-md">
              {t.home.viewAll}
              <ArrowRightIcon size={16} />
            </Link>
          </div>
        </section>
      )}

      {/* ------------------------------- deals ----------------------------- */}
      <section className="page-container pt-14 lg:pt-20">
        <div className="deals-editorial reveal flex flex-col justify-between gap-8 px-6 py-12 sm:px-12 sm:py-16 lg:flex-row lg:items-end">
          <span className="ghost" aria-hidden="true">
            −%
          </span>
          <div className="relative">
            <p className="eyebrow text-panel-muted">{t.nav.deals}</p>
            <h2 className="display-lg mt-4 max-w-xl">{t.home.dealsTitle}</h2>
            <p className="mt-4 max-w-md text-sm text-panel-muted sm:text-base">{t.home.dealsText}</p>
          </div>
          <Link
            href="/catalog?sale=1"
            className="btn btn-lg relative shrink-0 bg-surface text-ink-900 hover:bg-brand-solid hover:text-brand-on-solid"
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
        <section id="new-arrivals" className="page-container pt-14 lg:pt-20">
          <div className="section-head reveal">
            <div>
              <p className="eyebrow">{t.home.newArrivals}</p>
              <h2 className="display-md mt-2 text-ink-900">{t.home.newArrivalsHint}</h2>
            </div>
            <SectionLink href="/catalog">{t.home.viewAll}</SectionLink>
          </div>

          <div className={`mt-8 ${PRODUCT_GRID_WIDE}`}>
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------- why ------------------------------ */}
      <section className="page-container pt-14 pb-16 lg:pt-20 lg:pb-24">
        <div className="section-head reveal">
          <p className="eyebrow">{t.home.whyTitle}</p>
        </div>

        {/* Four claims as four columns, each numbered in the serif, the
            icon small beside the title. */}
        <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((perk, index) => (
            <div key={perk.title} className="reveal">
              <span className="display-md block text-ink-300">{String(index + 1).padStart(2, "0")}</span>
              <h3 className="mt-4 flex items-center gap-2.5 text-lg text-ink-900">
                <perk.icon size={18} className="shrink-0 text-brand-600" />
                {perk.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{perk.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
