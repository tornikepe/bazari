import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { discountPercent } from "@/lib/format";
import { productCardSelect } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { StickyBuyBar } from "@/components/product/StickyBuyBar";
import { Price } from "@/components/ui/Price";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CheckIcon, CloseIcon, RefreshIcon, ShieldIcon, TruckIcon } from "@/components/ui/icons";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_TITLE, SITE_URL } from "@/lib/site";

const LOW_STOCK_THRESHOLD = 10;

function getProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: { category: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, { locale }] = await Promise.all([getProduct(slug), getI18n()]);
  if (!product) return {};

  const name = locale === "ka" ? product.nameKa : product.nameEn;
  const description = (
    locale === "ka" ? product.descriptionKa : product.descriptionEn
  ).slice(0, 160);

  return {
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      type: "website",
      description,
      url: `/product/${product.slug}`,
      images: [{ url: product.image, alt: name }],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale, t } = await getI18n();

  const product = await getProduct(slug);
  if (!product) notFound();

  const related = await prisma.product.findMany({
    where: { isActive: true, categoryId: product.categoryId, NOT: { id: product.id } },
    select: productCardSelect,
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  const name = locale === "ka" ? product.nameKa : product.nameEn;
  const description = locale === "ka" ? product.descriptionKa : product.descriptionEn;
  const categoryName = locale === "ka" ? product.category.nameKa : product.category.nameEn;
  const discount = discountPercent(product.price, product.oldPrice);
  const soldOut = product.stock <= 0;

  const details = [
    { label: t.product.brand, value: product.brand || "—" },
    { label: t.product.category, value: categoryName },
    { label: t.product.sku, value: product.slug },
    {
      label: t.product.shipping,
      value: fill(t.product.shippingDays, { count: product.shippingDays }),
    },
  ];

  const guarantees = [
    { icon: TruckIcon, text: t.topbar.shipping },
    { icon: RefreshIcon, text: t.home.why3Title },
    { icon: ShieldIcon, text: t.home.why4Title },
  ];

  // Structured data. Only facts already on the page: no rating or review
  // fields, because the shop deliberately has neither and inventing them in
  // markup is exactly the kind of thing Google penalises.
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description: locale === "ka" ? product.descriptionKa : product.descriptionEn,
    sku: product.sku,
    image: `${SITE_URL}${product.image}`,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    category: categoryName,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${product.slug}`,
      priceCurrency: "GEL",
      // schema.org wants the human price, not tetri.
      price: (product.price / 100).toFixed(2),
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: SITE_TITLE },
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: t.nav.home, item: SITE_URL },
      { "@type": "ListItem", position: 2, name: t.catalog.title, item: `${SITE_URL}/catalog` },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryName,
        item: `${SITE_URL}/catalog?category=${product.category.slug}`,
      },
      { "@type": "ListItem", position: 4, name },
    ],
  };

  return (
    <div className="page-container py-6 lg:py-8">
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />

      <nav aria-label="breadcrumb" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
        <Link href="/" className="transition-colors hover:text-brand-600">
          {t.nav.home}
        </Link>
        <span>/</span>
        <Link href="/catalog" className="transition-colors hover:text-brand-600">
          {t.catalog.title}
        </Link>
        <span>/</span>
        <Link
          href={`/catalog?category=${product.category.slug}`}
          className="transition-colors hover:text-brand-600"
        >
          {categoryName}
        </Link>
        <span>/</span>
        <span className="truncate text-ink-600">{name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* ------------------------------ gallery ---------------------------- */}
        <div className="card relative aspect-square overflow-hidden bg-ink-50 lg:sticky lg:top-[calc(var(--header-h)+1.5rem)]">
          <Image
            src={product.image}
            alt={name}
            fill
            sizes="(max-width: 1024px) 100vw, 560px"
            className="object-cover"
            priority
          />

          {discount > 0 && (
            <span className="badge absolute top-4 left-4 bg-brand-solid text-sm text-brand-on-solid shadow-sm">
              {fill(t.product.sale, { percent: discount })}
            </span>
          )}
        </div>

        {/* ------------------------------- info ------------------------------ */}
        <div>
          {product.brand && (
            <span className="text-xs font-bold tracking-wider text-ink-400 uppercase">
              {product.brand}
            </span>
          )}

          <h1 className="mt-1.5 text-2xl leading-tight font-extrabold tracking-tight text-ink-900">
            {name}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Price value={product.price} oldValue={product.oldPrice} size="xl" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {soldOut ? (
              <span className="badge bg-danger-soft text-danger">
                <CloseIcon size={13} />
                {t.product.outOfStock}
              </span>
            ) : (
              <span className="badge bg-success-soft text-success">
                <CheckIcon size={13} />
                {t.product.inStock}
              </span>
            )}

            {!soldOut && product.stock <= LOW_STOCK_THRESHOLD && (
              <span className="badge bg-warning-soft text-warning">
                {fill(t.product.lowStock, { count: product.stock })}
              </span>
            )}
          </div>

          {description && (
            <p className="mt-5 text-base leading-relaxed text-ink-600">{description}</p>
          )}

          <div className="mt-6" id="buy-panel">
            <ProductPurchasePanel
              product={{
                productId: product.id,
                slug: product.slug,
                nameKa: product.nameKa,
                nameEn: product.nameEn,
                image: product.image,
                price: product.price,
                stock: product.stock,
              }}
            />
          </div>

          {/* guarantees */}
          <ul className="mt-6 flex flex-col gap-2.5 rounded-card border border-line bg-surface p-4">
            {guarantees.map((item) => (
              <li key={item.text} className="flex items-center gap-2.5 text-xs text-ink-600">
                <item.icon size={16} className="shrink-0 text-brand-600" />
                {item.text}
              </li>
            ))}
          </ul>

          {/* details */}
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-bold text-ink-900">{t.product.details}</h2>
            <dl className="overflow-hidden rounded-card border border-line">
              {details.map((detail, index) => (
                <div
                  key={detail.label}
                  className={`flex items-center justify-between gap-4 px-4 py-2.5 text-xs ${
                    index % 2 === 0 ? "bg-surface" : "bg-ink-50"
                  }`}
                >
                  <dt className="text-ink-500">{detail.label}</dt>
                  <dd className="text-right font-semibold text-ink-800">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* ------------------------------ related ------------------------------ */}
      {related.length > 0 && (
        <section className="mt-12">
          <SectionHeading title={t.product.related} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {/* Follows the visitor down the page once the panel above is gone. */}
      <StickyBuyBar
        watchId="buy-panel"
        product={{
          productId: product.id,
          slug: product.slug,
          nameKa: product.nameKa,
          nameEn: product.nameEn,
          image: product.image,
          price: product.price,
          stock: product.stock,
        }}
      />
    </div>
  );
}
