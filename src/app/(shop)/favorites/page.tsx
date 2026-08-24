"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductGridSkeleton, PRODUCT_GRID_WIDE } from "@/components/ui/ProductGridSkeleton";
import { TrashIcon } from "@/components/ui/icons";
import { clearFavorites } from "@/lib/favorites-store";
import { getProductsByIds } from "@/app/actions/products";
import type { ProductCardData } from "@/lib/catalog";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyHeartArt } from "@/components/ui/illustrations";

export default function FavoritesPage() {
  const { t } = useI18n();
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

  return (
    <div className="page">
      <PageHeader
        crumbs={[{ label: t.nav.home, href: "/" }, { label: t.favorites.title }]}
        title={t.favorites.title}
        count={!isLoading && products.length > 0 ? products.length : undefined}
        action={
          !isLoading && products.length > 0 ? (
            <button
              type="button"
              onClick={clearFavorites}
              className="btn btn-ghost btn-sm hover:text-danger"
            >
              <TrashIcon size={15} />
              {t.favorites.clear}
            </button>
          ) : undefined
        }
      />

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
