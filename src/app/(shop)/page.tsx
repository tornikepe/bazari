import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { productCardSelect } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
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
      <section className="relative overflow-hidden bg-panel text-panel-fg">
        {/* Decorative only, and pointer-events-none so it can never eat a
            click. Two blurred orbs drift on long, offset cycles, which reads
            as movement without ever drawing the eye away from the copy. Both
            animate transform alone, so they cannot shift the layout. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="hero-orb hero-orb-a -top-32 -right-24 h-[28rem] w-[28rem]"
            style={{ background: "radial-gradient(circle, rgba(222,31,36,0.55), transparent 68%)" }}
          />
          <div
            className="hero-orb hero-orb-b -bottom-40 -left-28 h-[26rem] w-[26rem]"
            style={{ background: "radial-gradient(circle, rgba(249,141,7,0.34), transparent 68%)" }}
          />

          {/* A faint grid gives the dark panel some structure up close. */}
          <div
            className="absolute inset-0 opacity-[0.055]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              maskImage: "radial-gradient(60% 60% at 50% 40%, #000, transparent)",
              WebkitMaskImage: "radial-gradient(60% 60% at 50% 40%, #000, transparent)",
            }}
          />
        </div>

        <div className="page-container relative grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div className="animate-rise">
            {/* The sheen is a clipped highlight that sweeps across the words
                every few seconds. `relative` + `overflow-hidden` keeps it
                inside the heading, and it never affects layout. */}
            <div className="relative overflow-hidden">
              <h1 className="text-3xl leading-[1.15] font-extrabold tracking-tight">
                {t.home.heroTitle}
              </h1>
              <span
                aria-hidden="true"
                className="hero-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
                }}
              />
            </div>

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
          <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {categories.slice(0, 6).map((category) => (
              <Link
                key={category.slug}
                href={`/catalog?category=${category.slug}`}
                className="group flex flex-col rounded-card border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10"
              >
                {/* Chip keeps the icon a fixed size, so tiles stay aligned
                    whatever emoji a category uses. */}
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-control bg-white/10 text-lg transition-colors group-hover:bg-white/20"
                >
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

        {/* Brand strip. Every name is a real `brand` value counted from the
            catalogue — nothing here is decorative filler. Rendered twice so
            the loop has no visible seam; the copy is hidden from screen
            readers and the list is not focusable, so it reads once. */}
        {brands.length > 0 && (
          <div className="marquee relative border-t border-white/10 py-4">
            <div className="marquee-track gap-10">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  aria-hidden={copy === 1 || undefined}
                  className="flex shrink-0 items-center gap-10 pr-10"
                >
                  {brands.map(({ brand }) => (
                    <span
                      key={`${copy}-${brand}`}
                      className="text-sm font-semibold whitespace-nowrap text-ink-400"
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ----------------------------- categories -------------------------- */}
      <Reveal as="section" className="page-container py-12">
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
              className="card hover-lift flex flex-col items-center gap-2 p-4 text-center hover:border-brand-200"
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
      </Reveal>

      {/* ------------------------------ featured --------------------------- */}
      {featured.length > 0 && (
        <Reveal as="section" className="page-container py-4 pb-12">
          <SectionHeading
            title={t.home.featured}
            hint={t.home.featuredHint}
            href="/catalog"
            linkLabel={t.home.viewAll}
          />

          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Reveal>
      )}

      {/* ---------------------------- deals banner ------------------------- */}
      <Reveal as="section" className="page-container pb-12">
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
      </Reveal>

      {/* ---------------------------- new arrivals ------------------------- */}
      {newArrivals.length > 0 && (
        <Reveal as="section" className="page-container pb-12">
          <SectionHeading
            title={t.home.newArrivals}
            hint={t.home.newArrivalsHint}
            href="/catalog"
            linkLabel={t.home.viewAll}
          />

          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {newArrivals.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Reveal>
      )}

      {/* -------------------------------- why ------------------------------ */}
      <Reveal as="section" className="border-t border-line bg-surface">
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
      </Reveal>
    </>
  );
}
