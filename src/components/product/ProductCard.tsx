"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { CardActions } from "@/components/product/CardActions";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { Price } from "@/components/ui/Price";
import { TruckIcon } from "@/components/ui/icons";
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
    // `hover-lift`: under the pointer it lifts and its picture leans in.
    <article className="product-card group hover-lift reveal-view card relative flex flex-col overflow-hidden">
      <Link
        href={`/product/${product.slug}`}
        onClick={opened}
        className="card-media relative block aspect-square overflow-hidden bg-ink-50"
      >
        <Image
          src={product.image}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          priority={priority}
          className="object-cover"
        />

        <FavoriteButton
          productId={product.id}
          className="absolute top-2.5 right-2.5 z-10"
        />

        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="badge bg-brand-solid text-brand-on-solid">
              {fill(t.product.sale, { percent: discount })}
            </span>
          )}
          {soldOut && (
            <span className="badge bg-panel text-panel-fg">
              {t.product.outOfStock}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        {/* Always rendered, even when empty — a missing brand would otherwise
            pull this card's title up out of line with its neighbours. */}
        <span className="label truncate text-ink-400">
          {product.brand || " "}
        </span>

        <h3 className="text-sm font-medium text-ink-800">
          <Link
            href={`/product/${product.slug}`}
            onClick={opened}
            className="clamp-2 transition-colors hover:text-brand-600"
          >
            {name}
          </Link>
        </h3>

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          {/* Absent until somebody real has written one: a row of empty
              stars is a shop asking to be rated by people who have not
              bought anything. Cards stay in line either way — the block
              above grows, not this one. */}
          {product.ratingCount > 0 && (
            <Stars sum={product.ratingSum} count={product.ratingCount} t={t} />
          )}
          <Price value={product.price} oldValue={product.oldPrice} size="lg" />

          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <TruckIcon size={13} className="shrink-0" />
            <span>
              {fill(t.product.shippingDays, { count: product.shippingDays })}
            </span>
          </div>

          {lowStock && (
            <span className="text-xs font-semibold text-warning">
              {fill(t.product.lowStock, { count: product.stock })}
            </span>
          )}

          {/* Into the cart, or straight to the checkout. A product sold in
              sizes opens its sizes on the card — see `CardActions`. */}
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
    </article>
  );
}
