"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductGridSkeleton, PRODUCT_GRID_WIDE } from "@/components/ui/ProductGridSkeleton";
import { HeartIcon, TrashIcon } from "@/components/ui/icons";
import { clearFavorites } from "@/lib/favorites-store";
import { fill } from "@/lib/i18n";
import { getProductsByIds } from "@/app/actions/products";
import type { ProductCardData } from "@/lib/catalog";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

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
    <div className="page-container py-6 lg:py-8">
      <Breadcrumb
        className="mb-2"
        items={[{ label: t.nav.home, href: "/" }, { label: t.favorites.title }]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
          {t.favorites.title}
          {!isLoading && products.length > 0 && (
            <span className="ml-2 text-sm font-medium text-ink-400">
              {fill(t.favorites.count, { count: products.length })}
            </span>
          )}
        </h1>

        {!isLoading && products.length > 0 && (
          <button
            type="button"
            onClick={clearFavorites}
            className="btn btn-ghost btn-sm hover:text-danger"
          >
            <TrashIcon size={15} />
            {t.favorites.clear}
          </button>
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <ProductGridSkeleton count={4} />
        ) : products.length === 0 ? (
          <div className="card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-pill bg-ink-100 text-ink-400">
              <HeartIcon size={30} />
            </span>
            <h2 className="text-lg font-bold text-ink-900">{t.favorites.empty}</h2>
            <p className="text-sm text-ink-500">{t.favorites.emptyHint}</p>
            <Link href="/catalog" className="btn btn-primary btn-md mt-2">
              {t.cart.continueShopping}
            </Link>
          </div>
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
