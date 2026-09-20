"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { CardActions } from "@/components/product/CardActions";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { Price } from "@/components/ui/Price";
import { Stars } from "@/components/product/Stars";
import { discountPercent } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { trackProductEvent } from "@/lib/product-events";
import type { ProductCardData } from "@/lib/catalog";

const LOW_STOCK_THRESHOLD = 10;

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardData;
  /**
   * Fetch the picture at once rather than lazily: for the first row of a
   * list, which is on screen before anything scrolls and is usually the
   * page's largest paint. Lazy-loading that row cost the catalogue its LCP.
   */
  priority?: boolean;
}) {
  const { locale, t } = useI18n();

  // The card opened from a list, for the dashboard's funnel: one beacon,
  // and the navigation goes on as it would.
  const opened = () => trackProductEvent("click", [product.id]);

  const name = locale === "ka" ? product.nameKa : product.nameEn;
  const discount = discountPercent(product.price, product.oldPrice);
  const soldOut = product.stock <= 0;
  const needsChoice = product._count.options > 0;
  const lowStock = !soldOut && product.stock <= LOW_STOCK_THRESHOLD;

  return (
    // `reveal-view`: the card rises into place as it scrolls into view.
    // The picture is the card — a 4:5 photograph on the paper, the name
    // and the price set under it — and the two buttons rise over its foot
    // under the pointer. See `.product-card` in the stylesheet.
    <article className="product-card group reveal-view relative flex flex-col">
      <div className="relative">
        <Link
          href={`/product/${product.slug}`}
          onClick={opened}
          className="card-media relative block"
        >
          <Image
            src={product.image}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
            priority={priority}
            className="object-cover"
          />
        </Link>

        <FavoriteButton productId={product.id} className="absolute top-2.5 right-2.5 z-10" />

        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="badge bg-brand-solid text-brand-on-solid">
              {fill(t.product.sale, { percent: discount })}
            </span>
          )}
          {soldOut && <span className="badge bg-panel text-panel-fg">{t.product.outOfStock}</span>}
        </div>

        {/* Into the cart, or straight to the checkout. A product sold in
            sizes opens its sizes on the card — see `CardActions`. */}
        <div className="card-actions">
          <CardActions
            needsChoice={needsChoice}
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
      </div>

      <div className="card-body flex flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          {/* Always rendered, even when empty — a missing brand would
              otherwise pull this card's title up out of line with its
              neighbours. */}
          <span className="eyebrow truncate">{product.brand || " "}</span>
          {product.ratingCount > 0 && <Stars sum={product.ratingSum} count={product.ratingCount} t={t} />}
        </div>

        <h3 className="card-name text-ink-900">
          <Link
            href={`/product/${product.slug}`}
            onClick={opened}
            className="clamp-2 transition-colors hover:text-brand-600"
          >
            {name}
          </Link>
        </h3>

        <div className="mt-auto pt-1">
          <Price value={product.price} oldValue={product.oldPrice} size="md" />
        </div>

        {lowStock && (
          <span className="text-[11px] font-semibold text-warning">
            {fill(t.product.lowStock, { count: product.stock })}
          </span>
        )}
      </div>
    </article>
  );
}
