import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { productCardSelect } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
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

  return (
    <>
      {/* ------------------------------- hero ------------------------------ */}
      <section className="relative overflow-hidden bg-ink-900 text-white">
        {/* Decorative wash — pointer-events-none so it never eats clicks. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(60rem 30rem at 85% -10%, rgba(222,31,36,0.45), transparent 60%), radial-gradient(40rem 24rem at 5% 110%, rgba(249,141,7,0.28), transparent 65%)",
          }}
        />

        <div className="page-container relative grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <span className="badge bg-white/10 text-brand-200 ring-1 ring-white/15 backdrop-blur-sm">
              {t.home.heroBadge}
            </span>

            <h1 className="mt-4 text-3xl leading-[1.15] font-extrabold tracking-tight">
              {t.home.heroTitle}
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-300">
              {t.home.heroSubtitle}
            </p>

            {/* Equal-width on mobile so the two CTAs line up; natural width
                once there's room for them side by side. */}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/catalog" className="btn btn-primary btn-lg w-full sm:w-auto">
                {t.home.heroCta}
                <ArrowRightIcon size={17} />
              </Link>
              <Link
                href="/about"
                className="btn btn-lg w-full border border-white/20 bg-white/5 text-white backdrop-blur-sm hover:bg-white/10 sm:w-auto"
              >
                {t.home.heroSecondary}
              </Link>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
              {[
                { value: `${productCount}+`, label: t.home.statProducts },
                { value: String(categories.length), label: t.home.statCategories },
                { value: String(brands.length), label: t.home.statBrands },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-2xl font-extrabold tracking-tight">
                    {stat.value}
                  </dt>
                  <dd className="mt-0.5 text-xs text-ink-400">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Category quick-links, doubling as the hero's visual block */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {categories.slice(0, 6).map((category) => (
              <Link
                key={category.slug}
                href={`/catalog?category=${category.slug}`}
                className="group rounded-card border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/10"
              >
                <span className="text-2xl" aria-hidden="true">
                  {category.icon}
                </span>
                <p className="clamp-2 mt-2.5 text-sm font-semibold">{name(category)}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {category._count.products} {t.admin.productCount}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- categories -------------------------- */}
      <section className="page-container py-12">
        <SectionHeading
          title={t.home.shopByCategory}
          hint={t.home.shopByCategoryHint}
          href="/catalog"
          linkLabel={t.home.viewAll}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/catalog?category=${category.slug}`}
              className="card flex flex-col items-center gap-2 p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
            >
              <span className="text-3xl" aria-hidden="true">
                {category.icon}
              </span>
              <span className="clamp-2-xs text-xs font-semibold text-ink-800">
                {name(category)}
              </span>
              <span className="mt-auto text-xs text-ink-400">{category._count.products}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------ featured --------------------------- */}
      {featured.length > 0 && (
        <section className="page-container py-4 pb-12">
          <SectionHeading
            title={t.home.featured}
            hint={t.home.featuredHint}
            href="/catalog"
            linkLabel={t.home.viewAll}
          />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------- deals banner ------------------------- */}
      <section className="page-container pb-12">
        <div className="relative overflow-hidden rounded-card bg-brand-600 px-6 py-10 text-white sm:px-10 sm:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(30rem 18rem at 90% 20%, rgba(255,255,255,0.22), transparent 60%)",
            }}
          />
          <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold tracking-widest text-brand-100 uppercase">
                {t.nav.deals}
              </p>
              <h2 className="mt-2 max-w-lg text-2xl leading-tight font-extrabold tracking-tight">
                {t.home.dealsTitle}
              </h2>
              <p className="mt-2 max-w-md text-sm text-brand-100">{t.home.dealsText}</p>
            </div>

            <Link
              href="/catalog?sale=1"
              className="btn btn-lg shrink-0 bg-white text-brand-700 hover:bg-brand-50"
            >
              {t.home.viewAll}
              <ArrowRightIcon size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------- new arrivals ------------------------- */}
      {newArrivals.length > 0 && (
        <section className="page-container pb-12">
          <SectionHeading
            title={t.home.newArrivals}
            hint={t.home.newArrivalsHint}
            href="/catalog"
            linkLabel={t.home.viewAll}
          />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------- why ------------------------------ */}
      <section className="border-t border-line bg-surface">
        <div className="page-container py-12">
          <h2 className="mb-6 text-xl font-extrabold tracking-tight text-ink-900">
            {t.home.whyTitle}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {perks.map((perk) => (
              <div key={perk.title} className="rounded-card border border-line bg-canvas p-5">
                <span className="grid h-11 w-11 place-items-center rounded-control bg-brand-50 text-brand-600">
                  <perk.icon size={21} />
                </span>
                <h3 className="mt-3.5 text-sm font-bold text-ink-900">{perk.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{perk.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
