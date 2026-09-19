import type { Metadata } from "next";
import Link from "next/link";
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
import { CheckIcon, CloseIcon, RefreshIcon, ShieldIcon, StarIcon, TruckIcon } from "@/components/ui/icons";
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
import { parsePhotos } from "@/lib/product-photos";
import { Stars } from "@/components/product/Stars";
import { ReviewForm } from "@/components/product/ReviewForm";
import { ReviewPhotos } from "@/components/product/ReviewPhotos";
import { initialsOf } from "@/components/account/AccountIdentity";
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
  const [boughtTogether, related, reviews, ratingRows, ownOrders, ownReview] = await Promise.all([
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
        photos: { select: { id: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    // How the stars fall, for the bars beside the average: one grouped
    // query rather than five counts.
    prisma.review.groupBy({
      by: ["rating"],
      where: { productId: product.id, isPublished: true },
      _count: { _all: true },
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
          select: {
            rating: true,
            title: true,
            body: true,
            isPublished: true,
            photos: { select: { id: true }, orderBy: { createdAt: "asc" } },
          },
        })
      : Promise.resolve(null),
  ]);
  const reviewAllowed = mayReview(user?.role === "customer", ownOrders);
  const photoUrl = (id: string) => `/api/reviews/photos/${id}`;
  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratingRows.find((row) => row.rating === star)?._count._all ?? 0,
  }));

  const name = locale === "ka" ? product.nameKa : product.nameEn;
  const description = locale === "ka" ? product.descriptionKa : product.descriptionEn;
  const categoryName = locale === "ka" ? product.category.nameKa : product.category.nameEn;
  const discount = discountPercent(product.price, product.oldPrice);
  const soldOut = product.stock <= 0;

  /* Parsed once. The column is JSON, so its shape is the parser's promise
     rather than the database's, and a page that parsed it twice would be two
     places to get that wrong. */
  const photos = parsePhotos(product.photos);
  /* A product with no photo list of its own still has its `image` — the
     placeholder, or a single upload made before the list existed. */
  const gallery = photos.length > 0 ? photos : [{ url: product.image, altKa: "", altEn: "" }];

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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,11fr)_minmax(0,10fr)] lg:gap-12">
        {/* ------------------------------ gallery ---------------------------- */}
        {/* The picture scrolls with the page, as the words beside it do. It
            was pinned while the column beside it moved, and to a reader that
            read as the picture lagging behind the page rather than staying
            put on purpose. `lg:self-start` keeps the box its own height
            rather than the row's. */}
        <ProductGallery photos={gallery} name={name} badge={saleBadge} />

        {/* ------------------------------- info ------------------------------ */}
        {/* Read top to bottom the way a shopper decides: what it is, what it
            costs, whether it is there, then how to buy it — the buy panel in
            its own card so the eye lands on it — and only then the details. */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {product.brand && (
              <Link
                href={`/catalog?brand=${encodeURIComponent(product.brand)}`}
                className="text-xs font-bold tracking-wider text-ink-500 uppercase transition-colors hover:text-brand-600"
              >
                {product.brand}
              </Link>
            )}
            {product.brand && <span className="text-ink-300" aria-hidden="true">·</span>}
            <Link
              href={`/catalog?category=${product.category.slug}`}
              className="text-xs font-semibold text-ink-500 transition-colors hover:text-brand-600"
            >
              {categoryName}
            </Link>
          </div>

          <h1 className="mt-2 text-2xl leading-tight font-extrabold tracking-tight text-balance text-ink-900 sm:text-3xl">
            {name}
          </h1>

          {/* Nothing here until somebody real has written something. */}
          {product.ratingCount > 0 && (
            <div className="mt-2.5">
              <Stars sum={product.ratingSum} count={product.ratingCount} t={t} size="md" href="#reviews" />
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-2">
            <Price value={product.price} oldValue={product.oldPrice} size="xl" />
            {/* What the reduction is worth in money, beside the percentage on
                the photo: "−30%" is a claim, "you save ₾120" is a fact. */}
            {discount > 0 && product.oldPrice && (
              <span className="badge mb-1 bg-success-soft text-success">
                {fill(t.product.youSave, {
                  amount: formatPrice(product.oldPrice - product.price, locale),
                })}
              </span>
            )}
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
            <p className="mt-5 text-[15px] leading-relaxed text-ink-600">{description}</p>
          )}

          {/* Offered where the disappointment happens, above the buy panel
              that has nothing to offer. */}
          {soldOut && <WatchStock productId={product.id} />}

          <div className="card mt-6 card-pad" id="buy-panel">
            {/* A product with no options is exactly what it was before any of
                this existed: one price, one stock figure, one button. */}
            {options.length > 0 ? (
              <VariantPicker product={line} options={options} variants={variants} />
            ) : (
              <ProductPurchasePanel product={line} />
            )}
          </div>

          {/* The three promises as tiles — icon over a line of text, each
              centred — rather than a list that read as small print. */}
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {guarantees.map((item) => (
              <li
                key={item.text}
                className="card flex flex-col items-center gap-2 px-2 py-3 text-center text-[11px] leading-snug font-medium text-ink-600 sm:text-xs"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <item.icon size={18} />
                </span>
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
                    className={`grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-4 px-4 py-2.5 text-xs ${
                      index % 2 === 0 ? "bg-surface" : "bg-ink-50"
                    }`}
                  >
                    <dt className="text-ink-500">{spec.label}</dt>
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
                  className={`grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-4 px-4 py-2.5 text-xs ${
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
        <SectionHeading title={t.product.reviews} />

        {/* The figures first: the average, large, with the count under it;
            how the stars fall, as five bars; and the way to add one, when
            this reader may. One card, three cells, centred on a phone. */}
        <div className="card grid gap-6 card-pad sm:grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="text-center sm:pr-6 sm:text-left lg:border-r lg:border-line">
            <p className="text-4xl font-extrabold tracking-tight text-ink-900 tabular-nums">
              {product.ratingCount > 0 ? averageRating(product.ratingSum, product.ratingCount).toFixed(1) : "–"}
            </p>
            <div className="mt-1 flex justify-center sm:justify-start">
              {product.ratingCount > 0 ? (
                <Stars sum={product.ratingSum} count={product.ratingCount} t={t} size="md" />
              ) : (
                <span className="text-sm text-ink-400">{t.product.reviewsNone}</span>
              )}
            </div>
            {product.ratingCount > 0 && (
              <p className="mt-1 text-xs text-ink-500">
                {countText(t.product.reviewsCountOne, t.product.reviewsCount, product.ratingCount)}
              </p>
            )}
          </div>

          <ol className="flex flex-col gap-1.5">
            {starCounts.map(({ star, count }) => (
              <li key={star} className="flex items-center gap-2.5 text-xs text-ink-500 tabular-nums">
                <span className="w-3 text-right font-semibold text-ink-700">{star}</span>
                <StarIcon size={12} filled className="shrink-0 text-accent-500" />
                <span className="h-2 flex-1 overflow-hidden rounded-pill bg-ink-100">
                  <span
                    className="block h-full rounded-pill bg-accent-500 transition-[width] duration-500"
                    style={{
                      width: `${product.ratingCount > 0 ? (count / product.ratingCount) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="w-6 text-right">{count}</span>
              </li>
            ))}
          </ol>

          <div className="flex flex-col items-center gap-2 text-center lg:items-end lg:text-right">
            {reviewAllowed.ok ? (
              <>
                {ownReview && !ownReview.isPublished && (
                  <p className="text-xs text-ink-500">{t.product.reviewHidden}</p>
                )}
                <ReviewForm
                  slug={product.slug}
                  existing={
                    ownReview
                      ? {
                          rating: ownReview.rating,
                          title: ownReview.title,
                          body: ownReview.body,
                          photos: ownReview.photos.map((photo) => ({
                            id: photo.id,
                            url: photoUrl(photo.id),
                          })),
                        }
                      : null
                  }
                />
              </>
            ) : (
              <p className="max-w-xs text-xs leading-relaxed text-ink-400">
                {t.product.reviewsNoneHint}
              </p>
            )}
          </div>
        </div>

        {reviews.length > 0 && (
          <ol className="mt-4 grid gap-4 lg:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id} className="card card-pad-tight">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-brand-50 text-xs font-extrabold text-brand-700"
                  >
                    {initialsOf(review.user.name, "")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink-900">
                      {review.user.name || t.product.reviewVerified}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-400">
                      <span>{formatDate(review.createdAt)}</span>
                      {/* Every review here is one, which is why the badge is
                          not a filter but a statement. */}
                      <span className="badge bg-success-soft text-success whitespace-nowrap">
                        {t.product.reviewVerified}
                      </span>
                      {user && review.userId === user.id && (
                        <span className="whitespace-nowrap">· {t.product.reviewYours}</span>
                      )}
                    </p>
                  </div>
                  {/* Five stars, the lit ones this review's — not the shared
                      `Stars`, whose "(1)" count is a fact about one review
                      that says nothing. */}
                  <span
                    role="img"
                    aria-label={fill(t.product.reviewStars, { count: review.rating })}
                    className="flex shrink-0 items-center gap-px"
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <StarIcon
                        key={star}
                        size={14}
                        filled={star <= review.rating}
                        className={star <= review.rating ? "text-accent-500" : "text-ink-300"}
                      />
                    ))}
                  </span>
                </div>

                {review.title && (
                  <p className="mt-3 text-sm font-bold text-ink-900">{review.title}</p>
                )}
                {review.body && (
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink-700">
                    {review.body}
                  </p>
                )}

                <ReviewPhotos
                  photos={review.photos.map((photo) => ({ id: photo.id, url: photoUrl(photo.id) }))}
                />
              </li>
            ))}
          </ol>
        )}
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
