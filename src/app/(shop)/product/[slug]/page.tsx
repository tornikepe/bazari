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
import { Price } from "@/components/ui/Price";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AlertIcon, BagCheckIcon, CheckIcon, RefreshIcon, StarIcon, TagIcon, TruckIcon } from "@/components/ui/icons";
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
import { initialsOf } from "@/components/account/initials";
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
    /* The SKU, as the line under the title says it: the slug is the
       address, not a code anyone quotes. */
    { label: t.product.sku, value: product.sku },
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
    { icon: BagCheckIcon, text: t.home.why4Title },
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

      {/* Laid out as the reference shop lays a product: the pictures at the
          left, half the width; at the right the name with the brand's mark
          beside it, the model code, the price, the size and the quantity,
          the wide dark button with the heart, and the rest folded under
          two rows. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-10">
        {/* ------------------------------ gallery ---------------------------- */}
        <ProductGallery photos={gallery} name={name} badge={saleBadge} />

        {/* ------------------------------- info ------------------------------ */}
        {/* Spans both rows at the right, so the reviews under the photo at
            the left never move when a row here is folded or unfolded. */}
        <div className="min-w-0 lg:row-span-2 lg:pt-1">
          {/* The name at the left, the brand's mark at the right — the mark
              is the way to everything the brand sells. */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="display-md min-w-0 text-balance text-ink-900">{name}</h1>
            {product.brand && (
              <Link
                href={`/catalog?brand=${encodeURIComponent(product.brand)}`}
                title={t.product.brandAll}
                className="brand-mark"
              >
                <span aria-hidden="true">{product.brand}</span>
                <span className="sr-only">{t.product.brandAll}</span>
              </Link>
            )}
          </div>

          <p className="mt-3 text-sm text-ink-500">
            {t.product.modelCode}: <span className="font-mono text-ink-700">{product.sku}</span>
          </p>

          {/* The price, and under it two marks on a line of their own:
              what the reduction is worth, and whether it is there — each a
              small bordered pill in its own tone with a mark before the
              words, so the two read as facts about the price rather than
              as more price. */}
          <div className="mt-4">
            <Price value={product.price} oldValue={product.oldPrice} size="xl" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {discount > 0 && product.oldPrice && (
              <span className="price-tag is-save">
                <TagIcon size={14} />
                {fill(t.product.youSave, {
                  amount: formatPrice(product.oldPrice - product.price, locale),
                })}
              </span>
            )}
            <span
              className={`price-tag ${soldOut ? "is-out" : product.stock <= LOW_STOCK_THRESHOLD ? "is-low" : "is-stock"}`}
            >
              {soldOut ? <AlertIcon size={14} /> : product.stock <= LOW_STOCK_THRESHOLD ? <AlertIcon size={14} /> : <CheckIcon size={14} strokeWidth={3} />}
              {soldOut
                ? t.product.outOfStock
                : product.stock <= LOW_STOCK_THRESHOLD
                  ? fill(t.product.lowStock, { count: product.stock })
                  : t.product.inStock}
            </span>
          </div>

          {/* Nothing here until somebody real has written something. */}
          {product.ratingCount > 0 && (
            <div className="mt-3">
              <Stars sum={product.ratingSum} count={product.ratingCount} t={t} size="md" href="#reviews" />
            </div>
          )}

          {/* Offered where the disappointment happens, above the buy panel
              that has nothing to offer. */}
          {soldOut && <WatchStock productId={product.id} />}

          <div className="mt-7" id="buy-panel">
            {options.length > 0 ? (
              <VariantPicker product={line} options={options} variants={variants} />
            ) : (
              <ProductPurchasePanel product={line} />
            )}
          </div>

          {/* The rest, folded under two rows with a plus at the end, the
              way the reference keeps its page short: the details — the
              description, the specifications, the facts — and delivery. */}
          <div className="mt-7 border-t border-line">
            <details className="fold" open>
              <summary>{t.product.detailsAccordion}</summary>
              <div className="fold-body">
                {description && <p className="text-[15px] leading-relaxed text-ink-600">{description}</p>}
                {specs.length > 0 && (
                  <dl className="mt-4 overflow-hidden rounded-card border border-line">
                    {specs.map((spec, index) => (
                      <div
                        key={`${spec.label}-${index}`}
                        className={`grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-4 px-4 py-2.5 text-xs ${
                          index % 2 === 0 ? "bg-surface" : "bg-ink-50"
                        }`}
                      >
                        <dt className="text-ink-500">{spec.label}</dt>
                        <dd className="text-right font-semibold text-ink-800">{spec.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <dl className="mt-4 overflow-hidden rounded-card border border-line">
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
            </details>

            <details className="fold">
              <summary>{t.product.deliveryAccordion}</summary>
              <ul className="fold-body flex flex-col gap-2.5">
                {guarantees.map((item) => (
                  <li key={item.text} className="flex items-center gap-3 text-sm text-ink-700">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                      <item.icon size={16} />
                    </span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      {/* ------------------------------ reviews ------------------------------ */}
      {/* Under the photo, in the left column, where the folding rows at the
          right cannot move it. Drawn even when empty — the empty state is
          where the rule is stated, and the rule is the point. */}
      <section id="reviews" className="min-w-0 scroll-mt-[calc(var(--header-h)+1rem)] lg:col-start-1 lg:row-start-2">
        <SectionHeading title={t.product.reviews} />

        {/* The figures first: the average, large, with the count under it;
            how the stars fall, as five bars; and the way to add one, when
            this reader may. One card, three cells, centred on a phone. */}
        <div className="card grid gap-6 card-pad sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="text-center sm:pr-6 sm:text-left sm:border-r sm:border-line">
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

          <div className="flex flex-col items-center gap-2 text-center sm:col-span-2 sm:items-start sm:text-left">
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
          <ol className="mt-4 grid gap-4">
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

      </div>

      {/* -------------------------- bought together -------------------------- */}
      {/* Above "related", because it is the stronger claim: this row is
          counted from orders the shop has taken, and the one below it is a
          guess by category. Absent entirely when nothing has been bought
          alongside this product — a "customers also bought" row filled with
          whatever shares a shelf is a recommendation nobody made. */}
      {boughtTogether.length > 0 && (
        <section className="reveal mt-12">
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
        <section className="reveal mt-12">
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

    </div>
  );
}
