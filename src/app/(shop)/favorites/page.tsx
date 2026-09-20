"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductGridSkeleton, PRODUCT_GRID_WIDE } from "@/components/ui/ProductGridSkeleton";
import { HeartIcon, TrashIcon } from "@/components/ui/icons";
import { clearFavorites } from "@/lib/favorites-store";
import { getProductsByIds } from "@/app/actions/products";
import type { ProductCardData } from "@/lib/catalog";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { countText } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyHeartArt } from "@/components/ui/illustrations";

export default function FavoritesPage() {
  const { t, locale } = useI18n();
  const favoriteIds = useFavorites();

  const [products, setProducts] = useState<ProductCardData[] | null>(null);
  const [, startTransition] = useTransition();

  // The ids live in localStorage, so the products can only be fetched once the
  // client knows them. Re-runs whenever the wishlist changes.
  const key = favoriteIds.join(",");
  useEffect(() => {
    let active = true;

    startTransition(async () => {
      const rows = await getProductsByIds(key ? key.split(",") : []);
      if (active) setProducts(rows);
    });

    return () => {
      active = false;
    };
  }, [key]);

  const isLoading = products === null;
  const worth = products?.reduce((sum, product) => sum + product.price, 0) ?? 0;

  return (
    <div className="page">
      <div className="mx-auto w-full max-w-4xl">
        <Breadcrumb
          className="mb-4"
          items={[{ label: t.nav.home, href: "/" }, { label: t.favorites.title }]}
        />

        {/* The same card the account opens with — the banner, a mark on
            its lower edge, the name beside it — with a heart for the mark:
            the wishlist is the other page that is *yours*. What the list
            holds is said under the title, not as a figure beside it. */}
        <div className="card shine-once overflow-hidden">
          <div className="identity-band" aria-hidden="true" />
          <div className="card-pad -mt-10 flex flex-wrap items-end gap-x-4 gap-y-3 pt-0">
            <span className="avatar-ring shrink-0 ring-4 ring-surface">
              <span
                aria-hidden="true"
                className="grid h-18 w-18 place-items-center rounded-[calc(var(--radius-card)-3px)] bg-brand-solid text-brand-on-solid sm:h-20 sm:w-20"
              >
                <HeartIcon size={30} filled />
              </span>
            </span>
            <div className="min-w-0 flex-1 pb-0.5">
              <h1 className="text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">
                {t.favorites.title}
              </h1>
              <p className="text-sm text-ink-500">
                {isLoading
                  ? "…"
                  : products.length === 0
                    ? t.favorites.emptyHint
                    : `${countText(t.favorites.countOne, t.favorites.count, products.length)} · ${t.favorites.worth} ${formatPrice(worth, locale)}`}
              </p>
            </div>
            {!isLoading && products.length > 0 && (
              <div className="flex w-full flex-wrap items-center gap-2 pb-1 sm:w-auto">
                <Link href="/catalog" className="btn btn-outline btn-sm">
                  {t.catalog.title}
                </Link>
                <button
                  type="button"
                  onClick={clearFavorites}
                  className="btn btn-ghost btn-sm hover:text-danger"
                >
                  <TrashIcon size={15} />
                  {t.favorites.clear}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <ProductGridSkeleton count={4} />
        ) : products.length === 0 ? (
          <EmptyState
            className="card mx-auto max-w-md"
            art={<EmptyHeartArt size={96} />}
            title={t.favorites.empty}
            text={t.favorites.emptyHint}
            action={
              <Link href="/catalog" className="btn btn-primary btn-md">
                {t.cart.continueShopping}
              </Link>
            }
          />
        ) : (
          <div className={PRODUCT_GRID_WIDE}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
