"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { Price } from "@/components/ui/Price";
import { TruckIcon } from "@/components/ui/icons";
import { discountPercent } from "@/lib/format";
import { fill } from "@/lib/i18n";
import type { ProductCardData } from "@/lib/catalog";

const LOW_STOCK_THRESHOLD = 10;

export function ProductCard({ product }: { product: ProductCardData }) {
  const { locale, t } = useI18n();

  const name = locale === "ka" ? product.nameKa : product.nameEn;
  const discount = discountPercent(product.price, product.oldPrice);
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= LOW_STOCK_THRESHOLD;

  return (
    <article className="group relative flex flex-col overflow-hidden bg-surface transition-colors hover:bg-ink-50">
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-ink-50"
      >
        <Image
          src={product.image}
          alt={name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
          className="object-cover"
        />

        <FavoriteButton productId={product.id} className="absolute top-2.5 right-2.5 z-10" />

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
            className="clamp-2 transition-colors hover:text-brand-600"
          >
            {name}
          </Link>
        </h3>

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          <Price value={product.price} oldValue={product.oldPrice} size="lg" />

          <div className="flex items-center gap-1.5 text-xs text-ink-500">
            <TruckIcon size={13} className="shrink-0" />
            <span>{fill(t.product.shippingDays, { count: product.shippingDays })}</span>
          </div>

          {lowStock && (
            <span className="text-xs font-semibold text-warning">
              {fill(t.product.lowStock, { count: product.stock })}
            </span>
          )}

          <AddToCartButton
            product={{
              productId: product.id,
              slug: product.slug,
              nameKa: product.nameKa,
              nameEn: product.nameEn,
              image: product.image,
              price: product.price,
              stock: product.stock,
            }}
            fullWidth
          />
        </div>
      </div>
    </article>
  );
}
