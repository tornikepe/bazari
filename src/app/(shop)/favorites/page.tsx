"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { CardActions } from "@/components/product/CardActions";
import { SwipeAway } from "@/components/cart/SwipeAway";
import { Price } from "@/components/ui/Price";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import { clearFavorites, toggleFavorite } from "@/lib/favorites-store";
import { getProductsByIds } from "@/app/actions/products";
import type { ProductCardData } from "@/lib/catalog";
import { PageIntro } from "@/components/ui/PageIntro";
import { countText } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyHeartArt } from "@/components/ui/illustrations";

/**
 * The wishlist, laid out as the cart is: the head in the middle, the
 * lines in a card, the summary under them — beside them on a wide screen.
 * A line is the picture and the words, and under both a row with the way
 * into the cart at the left and the way off the list at the right.
 */
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

  if (isLoading) {
    return (
      <div className="page">
        <PageIntro eyebrow={t.account.menuWishlist} title={t.favorites.title} line="…" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-28 animate-pulse rounded-card bg-ink-100" />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-card bg-ink-100" />
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="page">
        {/* The card below says the sentence; the head only names the page. */}
        <PageIntro eyebrow={t.account.menuWishlist} title={t.favorites.title} />

        {/* The cart's empty page, with a heart: the card in the middle, and
            what was looked at under it. */}
        <EmptyState
          className="card mx-auto mt-8 max-w-md"
          art={<EmptyHeartArt size={96} />}
          title={t.favorites.empty}
          text={t.favorites.emptyHint}
          action={
            <Link href="/catalog" className="btn btn-primary btn-md">
              {t.cart.continueShopping}
            </Link>
          }
        />
        <RecentlyViewed take={4} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageIntro
        eyebrow={t.account.menuWishlist}
        title={t.favorites.title}
        line={`${countText(t.favorites.countOne, t.favorites.count, products.length)} · ${t.favorites.worth} ${formatPrice(worth, locale)}`}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-2.5 sm:gap-3">
          {products.map((product) => {
            const name = locale === "ka" ? product.nameKa : product.nameEn;
            return (
              <SwipeAway key={product.id} onRemove={() => toggleFavorite(product.id)} label={t.favorites.remove}>
                <article className="line-card">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(product.id)}
                    aria-label={t.favorites.remove}
                    title={t.favorites.remove}
                    className="line-x"
                  >
                    <CloseIcon size={14} strokeWidth={2.5} />
                  </button>

                  <Link href={`/product/${product.slug}`} className="line-pic">
                    <Image src={product.image} alt={name} fill sizes="(max-width: 640px) 104px, 96px" className="object-cover" />
                  </Link>

                  <div className="line-body">
                    {product.brand && <span className="line-brand">{product.brand}</span>}
                    <Link href={`/product/${product.slug}`} className="line-name">
                      {name}
                    </Link>
                    <div className="line-price">
                      <Price value={product.price} oldValue={product.oldPrice} size="sm" />
                    </div>
                  </div>

                  {/* Into the cart, as the card does it: a sized product
                      goes in as its first size, to be changed in the cart. */}
                  <div className="line-foot line-foot-one">
                    <CardActions
                      look="plain"
                      needsChoice={product._count.options > 0}
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
                </article>
              </SwipeAway>
            );
          })}
        </div>

        <aside className="card lg:sticky lg:top-[calc(var(--header-h)+1rem)] card-pad">
          <h2 className="display-sm text-center text-ink-900">{t.favorites.summary}</h2>
          <dl className="summary-totals mt-5">
            <div>
              <dt>{t.favorites.title}</dt>
              <dd>{countText(t.favorites.countOne, t.favorites.count, products.length)}</dd>
            </div>
            <div className="summary-total">
              <dt>{t.favorites.worth}</dt>
              <dd>
                <Price value={worth} size="lg" />
              </dd>
            </div>
          </dl>

          <Link href="/catalog" className="btn btn-primary btn-lg mt-5 w-full">
            {t.cart.continueShopping}
          </Link>

          <button type="button" onClick={clearFavorites} className="btn btn-ghost btn-md mt-3 w-full text-ink-600 hover:text-danger">
            <TrashIcon size={15} />
            {t.favorites.clear}
          </button>
        </aside>
      </div>
    </div>
  );
}
