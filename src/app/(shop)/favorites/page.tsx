"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import Image from "next/image";
import { RecentlyViewed } from "@/components/product/RecentlyViewed";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { Price } from "@/components/ui/Price";
import { ProductGridSkeleton } from "@/components/ui/ProductGridSkeleton";
import { HeartIcon, TrashIcon } from "@/components/ui/icons";
import { clearFavorites, toggleFavorite } from "@/lib/favorites-store";
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
          eyebrow={t.account.menuWishlist}
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
            /* The catalogue is always a step away; emptying the list only
               when there is one. The same two as the cart's banner. */
            isLoading ? undefined : (
              <>
                <Link href="/catalog" className="btn btn-outline btn-sm">
                  {t.catalog.title}
                </Link>
              </>
            )
          }
        />
      </div>

      <div className="mt-6">
        {isLoading ? (
          <ProductGridSkeleton count={4} />
        ) : products.length === 0 ? (
          <>
            {/* The cart's empty page, with a heart: the card in the middle,
                and what was looked at under it. */}
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
            <RecentlyViewed take={4} />
          </>
        ) : (
          /* The cart's own layout: the rows in a card at the left — the
             picture, the name, the price, and at the end of the row a way
             into the cart and a way off the list — and a summary at the
             right with what the list would cost. The two pages are one
             page with two verbs. */
          <div className="grid gap-6 lg:grid-cols-[1fr_21rem] lg:items-start">
            <div className="card flex min-w-0 flex-col overflow-hidden">
              {products.map((product) => {
                const name = locale === "ka" ? product.nameKa : product.nameEn;
                const needsChoice = product._count.options > 0;
                return (
                  <article
                    key={product.id}
                    className="flex gap-3 border-line p-3 not-first:border-t sm:gap-4 sm:p-4"
                  >
                    <Link
                      href={`/product/${product.slug}`}
                      className="relative h-24 w-24 shrink-0 overflow-hidden rounded-control border border-line bg-ink-50 sm:h-28 sm:w-28"
                    >
                      <Image src={product.image} alt={name} fill sizes="112px" className="object-cover" />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="eyebrow">{product.brand || " "}</span>
                      <Link
                        href={`/product/${product.slug}`}
                        className="clamp-2 mt-0.5 text-sm leading-snug font-semibold text-ink-800 transition-colors hover:text-brand-600"
                      >
                        {name}
                      </Link>
                      <div className="mt-1">
                        <Price value={product.price} oldValue={product.oldPrice} size="sm" />
                      </div>

                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                        {needsChoice ? (
                          /* Sold in sizes: the page is where the size is
                             chosen, so the row sends the shopper there. */
                          <Link href={`/product/${product.slug}`} className="btn btn-outline btn-sm">
                            {t.favorites.chooseOnPage}
                          </Link>
                        ) : (
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
                            size="sm"
                            variant="outline"
                            short
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(product.id)}
                          aria-label={t.favorites.remove}
                          className="btn btn-ghost h-8 w-8 rounded-control p-0 text-ink-400 hover:text-danger"
                        >
                          <TrashIcon size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
                <Link href="/catalog" className="btn btn-outline btn-sm">
                  {t.cart.continueShopping}
                </Link>
              </div>
            </div>

            <aside className="card sticky top-[var(--header-h)] card-pad">
              <h2 className="text-base font-bold text-ink-900">{t.favorites.summary}</h2>
              <dl className="mt-4 flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-500">{t.favorites.title}</dt>
                  <dd className="font-semibold text-ink-800">
                    {countText(t.favorites.countOne, t.favorites.count, products.length)}
                  </dd>
                </div>
                <div className="my-1 h-px bg-line" />
                <div className="flex items-center justify-between">
                  <dt className="text-base font-bold text-ink-900">{t.favorites.worth}</dt>
                  <dd>
                    <Price value={worth} size="lg" />
                  </dd>
                </div>
              </dl>

              <Link href="/catalog" className="btn btn-primary btn-lg mt-5 w-full">
                {t.catalog.title}
              </Link>

              <button
                type="button"
                onClick={clearFavorites}
                className="mt-4 flex w-full items-center justify-center gap-1.5 border-t border-line pt-3 text-xs text-ink-400 transition-colors hover:text-danger"
              >
                <TrashIcon size={13} />
                {t.favorites.clear}
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
