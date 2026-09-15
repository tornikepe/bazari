import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { countText, fill } from "@/lib/i18n";
import { discountPercent } from "@/lib/format";
import { productCardSelect } from "@/lib/catalog";
import { ProductCard } from "@/components/product/ProductCard";
// The same grid the home page uses — two columns only from 380px, because at
// 320px two cards are 140px each and the Georgian "add to cart" no longer fits
// its button. Chromium hid that by a pixel; Firefox did not.
import { PRODUCT_GRID_WIDE } from "@/components/ui/ProductGridSkeleton";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { StickyBuyBar } from "@/components/product/StickyBuyBar";
import { Price } from "@/components/ui/Price";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CheckIcon, CloseIcon, RefreshIcon, ShieldIcon, TruckIcon } from "@/components/ui/icons";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_TITLE, SITE_URL } from "@/lib/site";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ProductGallery } from "@/components/product/ProductGallery";
import { parseSpecs, readSpec } from "@/lib/product-specs";
import { getBoughtTogether } from "@/lib/cross-sell";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { RecordView } from "@/components/product/RecordView";
import { WatchStock } from "@/components/product/WatchStock";
import { VariantPicker } from "@/components/product/VariantPicker";
import { parsePhotos, altOf } from "@/lib/product-photos";
import { Stars } from "@/components/product/Stars";
import { ReviewForm } from "@/components/product/ReviewForm";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { averageRating, mayReview } from "@/lib/review-rules";
import { formatDate, formatPrice } from "@/lib/format";

const LOW_STOCK_THRESHOLD = 10;

function getProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: true,
      options: {
        orderBy: { sortOrder: "asc" },
        include: { values: { orderBy: { sortOrder: "asc" } } },
      },
      variants: {
        orderBy: { sortOrder: "asc" },
        include: { values: { select: { valueId: true } } },
      },
    },
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
      // No `images` here on purpose: setting it overrides the generated card
      // in `opengraph-image.tsx`, which is what actually renders the product
      // name and price. Pointing at `product.image` sent the shared
      // placeholder SVG instead — the same grey box for all forty products.
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale, t } = await getI18n();

  const product = await getProduct(slug);
  if (!product) notFound();

  /* What people actually bought alongside this, counted from real orders.
     Fetched with the related row rather than after it: they are drawn one
     above the other, and two round trips in sequence would delay the page by
     the slower of them twice. (The comment said so before the code did — the
     load test found the second `await` waiting on the first.) */
  const user = await getCurrentUser();
  const settings = await getSettings();
  const [boughtTogether, related, reviews, ownOrders, ownReview] = await Promise.all([
    getBoughtTogether(product.id),
    prisma.product.findMany({
      where: { isActive: true, categoryId: product.categoryId, NOT: { id: product.id } },
      select: productCardSelect,
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    // What people wrote, newest first. Only the published ones; a hidden
    // review is the shop's decision and not a thing to draw greyed out.
    prisma.review.findMany({
      where: { productId: product.id, isPublished: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true } },
      },
    }),
    // Whether this reader may write one: their orders of this product, any
    // status — the rule wants to know the difference between "never bought"
    // and "not here yet".
    user?.role === "customer"
      ? prisma.order.findMany({
          where: { userId: user.id, items: { some: { productId: product.id } } },
          select: { id: true, status: true },
        })
      : Promise.resolve([]),
    user?.role === "customer"
      ? prisma.review.findUnique({
          where: { productId_userId: { productId: product.id, userId: user.id } },
          select: { rating: true, title: true, body: true, isPublished: true },
        })
      : Promise.resolve(null),
  ]);
  const reviewAllowed = mayReview(user?.role === "customer", ownOrders);

  const name = locale === "ka" ? product.nameKa : product.nameEn;
  const description = locale === "ka" ? product.descriptionKa : product.descriptionEn;
  const categoryName = locale === "ka" ? product.category.nameKa : product.category.nameEn;
  const discount = discountPercent(product.price, product.oldPrice);
  const soldOut = product.stock <= 0;

  /* Parsed once. The column is JSON, so its shape is the parser's promise
     rather than the database's, and a page that parsed it twice would be two
     places to get that wrong. */
  const photos = parsePhotos(product.photos);

  /* The cart line as it would be without variants. The picker overrides the
     price and the stock once a combination is chosen; everything else on a
     line is the product's whatever is picked. */
  const line = {
    productId: product.id,
    slug: product.slug,
    nameKa: product.nameKa,
    nameEn: product.nameEn,
    image: product.image,
    price: product.price,
    stock: product.stock,
  };

  const options = product.options.map((option) => ({
    id: option.id,
    name: locale === "ka" ? option.nameKa : option.nameEn,
    values: option.values.map((value) => ({
      id: value.id,
      label: locale === "ka" ? value.valueKa : value.valueEn,
    })),
  }));

  const variants = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    price: variant.price,
    stock: variant.stock,
    isActive: variant.isActive,
    valueIds: variant.values.map((value) => value.valueId),
  }));

  /* What the shop typed, ahead of what the application knows.
     The four rows below — brand, category, SKU, shipping — are derived facts
     the page already shows elsewhere; a specification is the thing somebody
     actually wants before buying, so it goes first and the derived rows read
     as the footnote they are. */
  const specs = parseSpecs(product.specs).map((spec) => readSpec(spec, locale));

  const details = [
    { label: t.product.brand, value: product.brand || "—" },
    { label: t.product.category, value: categoryName },
    { label: t.product.sku, value: product.slug },
    {
      label: t.product.shipping,
      value: countText(t.product.shippingDaysOne, t.product.shippingDays, product.shippingDays),
    },
  ];

  /* The delivery line says the shop's own threshold, from the settings page
     — it said "over ₾200" whatever the shop had set. No threshold at all,
     and it says delivery is free. */
  const guarantees = [
    {
      icon: TruckIcon,
      text:
        settings.freeShippingThreshold > 0
          ? fill(t.topbar.shipping, {
              amount: formatPrice(settings.freeShippingThreshold, locale),
            })
          : t.topbar.shippingAlways,
    },
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
    /* schema.org takes a list, and Google shows more of a product that offers
       more than one photo. Absolute, because a structured-data consumer is not
       reading this from the page it was served on. */
    image: photos.map((photo) => `${SITE_URL}${photo.url}`),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    category: categoryName,
    /* Real, or absent. The counts come from reviews written by customers the
       product was delivered to, and there is no field here until there is
       at least one of them. */
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: averageRating(product.ratingSum, product.ratingCount),
            reviewCount: product.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
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

  /* One photo means one photo: a strip of thumbnails under a single image is
     a gallery control for a gallery that does not exist. Most of the seeded
     catalogue is in exactly that state, which is why the plain version below
     is not dead code waiting for a redesign.

     Deduplicated, because the same photo listed twice is never what anyone
     meant — the form already prevents it, and data can arrive from elsewhere. */


  const saleBadge =
    discount > 0 ? (
      <span className="badge absolute top-4 left-4 bg-brand-solid text-sm text-brand-on-solid">
        {fill(t.product.sale, { percent: discount })}
      </span>
    ) : null;

  return (
    <div className="page">
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />

      <Breadcrumb
        className="mb-4"
        items={[
          { label: t.nav.home, href: "/" },
          { label: t.catalog.title, href: "/catalog" },
          { label: categoryName, href: `/catalog?category=${product.category.slug}` },
          { label: name },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* ------------------------------ gallery ---------------------------- */}
        {/* The picture scrolls with the page, as the words beside it do. It
            was pinned while the column beside it moved, and to a reader that
            read as the picture lagging behind the page rather than staying
            put on purpose. `lg:self-start` keeps the box its own height
            rather than the row's. */}
        {photos.length > 1 ? (
          <ProductGallery photos={photos} name={name} badge={saleBadge} />
        ) : (
          <div className="card relative aspect-square overflow-hidden bg-ink-50 lg:self-start">
            <Image
              src={product.image}
              // The written description when there is one, the name when not.
              alt={altOf(photos[0], locale, name)}
              fill
              sizes="(max-width: 1024px) 100vw, 560px"
              className="object-cover"
              priority
            />
            {saleBadge}
          </div>
        )}

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

          {/* Nothing here until somebody real has written something. */}
          {product.ratingCount > 0 && (
            <div className="mt-2">
              <Stars sum={product.ratingSum} count={product.ratingCount} t={t} size="md" href="#reviews" />
            </div>
          )}

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

          {/* Offered where the disappointment happens, above the buy panel
              that has nothing to offer. */}
          {soldOut && <WatchStock productId={product.id} />}

          <div className="mt-6" id="buy-panel">
            {/* A product with no options is exactly what it was before any of
                this existed: one price, one stock figure, one button. */}
            {options.length > 0 ? (
              <VariantPicker product={line} options={options} variants={variants} />
            ) : (
              <ProductPurchasePanel product={line} />
            )}
          </div>

          {/* guarantees */}
          <ul className="card card-pad-tight mt-6 flex flex-col gap-2.5">
            {guarantees.map((item) => (
              <li key={item.text} className="flex items-center gap-2.5 text-xs text-ink-600">
                <item.icon size={16} className="shrink-0 text-brand-600" />
                {item.text}
              </li>
            ))}
          </ul>

          {/* specifications, when the shop has written any */}
          {specs.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-bold text-ink-900">{t.product.specs}</h2>
              <dl className="overflow-hidden rounded-card border border-line">
                {specs.map((spec, index) => (
                  <div
                    key={`${spec.label}-${index}`}
                    /* Zebra striping by row, which is what makes a long table
                       scannable across — the same rule the derived rows below
                       already used, applied to the table that matters more. */
                    className={`flex items-start justify-between gap-4 px-4 py-2.5 text-xs ${
                      index % 2 === 0 ? "bg-surface" : "bg-ink-50"
                    }`}
                  >
                    <dt className="shrink-0 text-ink-500">{spec.label}</dt>
                    <dd className="text-right font-semibold text-ink-800">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

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

      {/* ------------------------------ reviews ------------------------------ */}
      {/* Above the recommendations, because it is about *this* product and
          they are about others. Drawn even when empty — the empty state is
          where the rule is stated, and the rule is the point. */}
      <section id="reviews" className="mt-12 scroll-mt-[calc(var(--header-h)+1rem)]">
        <SectionHeading
          title={t.product.reviews}
          hint={
            product.ratingCount > 0
              ? `${t.product.reviewAverage} ${averageRating(product.ratingSum, product.ratingCount)} · ${countText(
                  t.product.reviewsCountOne,
                  t.product.reviewsCount,
                  product.ratingCount,
                )}`
              : undefined
          }
        />

        {/* Two columns only when there is a form to put in the second: a
            reader who cannot review here is not told why in a sidebar of
            their own, they simply see the reviews. */}
        <div
          className={`grid gap-6 lg:items-start ${reviewAllowed.ok ? "lg:grid-cols-[1fr_20rem]" : ""}`}
        >
          <div>
            {reviews.length === 0 ? (
              <div className="card card-pad">
                <p className="text-sm font-bold text-ink-900">{t.product.reviewsNone}</p>
                <p className="mt-1 text-sm text-ink-500">{t.product.reviewsNoneHint}</p>
              </div>
            ) : (
              <ol className="card divide-y divide-line">
                {reviews.map((review) => (
                  <li key={review.id} className="card-pad-tight">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Stars sum={review.rating} count={1} t={t} />
                      <span className="text-xs text-ink-400">{formatDate(review.createdAt)}</span>
                    </div>
                    {review.title && (
                      <p className="mt-2 text-sm font-bold text-ink-900">{review.title}</p>
                    )}
                    {review.body && (
                      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink-700">
                        {review.body}
                      </p>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <span className="font-semibold text-ink-700">
                        {review.user.name || t.product.reviewVerified}
                      </span>
                      {/* Every review here is one, which is why the badge is
                          not a filter but a statement. */}
                      <span className="badge bg-success-soft text-success">
                        {t.product.reviewVerified}
                      </span>
                      {user && review.userId === user.id && (
                        <span className="text-ink-400">· {t.product.reviewYours}</span>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {reviewAllowed.ok && (
            <aside className="flex flex-col gap-3">
              {ownReview && !ownReview.isPublished && (
                <p className="text-xs text-ink-500">{t.product.reviewHidden}</p>
              )}
              <ReviewForm
                slug={product.slug}
                existing={
                  ownReview
                    ? { rating: ownReview.rating, title: ownReview.title, body: ownReview.body }
                    : null
                }
              />
            </aside>
          )}
        </div>
      </section>

      {/* -------------------------- bought together -------------------------- */}
      {/* Above "related", because it is the stronger claim: this row is
          counted from orders the shop has taken, and the one below it is a
          guess by category. Absent entirely when nothing has been bought
          alongside this product — a "customers also bought" row filled with
          whatever shares a shelf is a recommendation nobody made. */}
      {boughtTogether.length > 0 && (
        <section className="mt-12">
          <SectionHeading title={t.product.boughtTogether} />
          <div className={PRODUCT_GRID_WIDE}>
            {boughtTogether.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------ related ------------------------------ */}
      {related.length > 0 && (
        <section className="mt-12">
          <SectionHeading title={t.product.related} />
          <div className={PRODUCT_GRID_WIDE}>
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed exclude={product.id} />

      {/* Notes the visit. Renders nothing; the list is this browser's own and
          never reaches the server. */}
      <RecordView productId={product.id} />

      {/* Follows the visitor down the page once the panel above is gone. */}
      <StickyBuyBar watchId="buy-panel" product={line} needsChoice={options.length > 0} />
    </div>
  );
}
