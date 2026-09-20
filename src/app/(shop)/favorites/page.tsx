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
import { PageBanner } from "@/components/account/PageBanner";
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

        {/* The same card the account and the cart open with — a heart
            for the mark: the wishlist is the other page that is *yours*.
            What the list holds is said under the title, not as a figure
            beside it. */}
        <PageBanner
          eyebrow={t.account.title}
          title={t.favorites.title}
          mark={
            <span
              aria-hidden="true"
              className="grid h-18 w-18 place-items-center rounded-[calc(var(--radius-card)-3px)] bg-brand-solid text-brand-on-solid sm:h-20 sm:w-20"
            >
              <HeartIcon size={30} filled />
            </span>
          }
          line={
            isLoading
              ? "…"
              : products.length === 0
                ? t.favorites.emptyHint
                : `${countText(t.favorites.countOne, t.favorites.count, products.length)} · ${t.favorites.worth} ${formatPrice(worth, locale)}`
          }
          aside={
            !isLoading && products.length > 0 ? (
              <>
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
              </>
            ) : undefined
          }
        />
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
