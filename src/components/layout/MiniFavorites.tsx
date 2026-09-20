"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import { getProductsByIds } from "@/app/actions/products";
import { toggleFavorite } from "@/lib/favorites-store";
import { Price } from "@/components/ui/Price";
import { formatPrice } from "@/lib/format";
import { HeartIcon, CloseIcon } from "@/components/ui/icons";
import { fill } from "@/lib/i18n";
import type { ProductCardData } from "@/lib/catalog";

/**
 * Answers already fetched, by the ids they answer. The list lives in
 * localStorage as ids alone, so the names and prices come from the server;
 * hovering the heart twice should not ask twice.
 */
const answers = new Map<string, ProductCardData[]>();

/**
 * The wishlist, under the heart.
 *
 * The newest few, each with its picture and price and a way off the list,
 * and the page for the rest. Fetched the first time the panel opens for a
 * given list and remembered after that.
 */
export function MiniFavorites() {
  const { t, locale } = useI18n();
  const favorites = useFavorites();
  // Newest first: the last thing saved is the thing most likely wanted.
  const wanted = [...favorites].reverse();
  const key = wanted.join(",");
  // The answer read straight from the cache during render, and the one the
  // effect fetched when the cache had none — state only for the second, so
  // a list already answered draws on the first render without an effect.
  const [fetched, setFetched] = useState<{ key: string; rows: ProductCardData[] } | null>(null);
  const products = answers.get(key) ?? (fetched?.key === key ? fetched.rows : null);

  useEffect(() => {
    if (!key || answers.has(key)) return;
    let live = true;
    getProductsByIds(key.split(","))
      .then((rows) => {
        answers.set(key, rows);
        if (live) setFetched({ key, rows });
      })
      .catch(() => {
        if (live) setFetched({ key, rows: [] });
      });
    return () => {
      live = false;
    };
  }, [key]);

  /* One height whatever the list holds — see `.mini-list` — so a line
     taken off does not pull the button under it up, and every line can
     be scrolled to. */
  const empty = favorites.length === 0;
  const rows = empty ? [] : (products ?? null);

  return (
    <>
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <p className="text-sm font-bold text-ink-900">{t.favorites.title}</p>
        <p className="text-xs text-ink-500 tabular-nums">
          {fill(favorites.length === 1 ? t.favorites.countOne : t.favorites.count, {
            count: favorites.length,
          })}
        </p>
      </div>

      {empty ? (
        /* Same head, box and foot as a list with something in it, so the
           panel is one size empty or full — and the same size as the cart's. */
        <div className="mini-list grid place-items-center px-5 text-center">
          <div>
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-pill bg-ink-100 text-ink-400">
              <HeartIcon size={22} />
            </span>
            <p className="mt-3 text-sm font-bold text-ink-900">{t.favorites.empty}</p>
            <p className="mt-1 text-xs text-ink-500">{t.favorites.emptyHint}</p>
          </div>
        </div>
      ) : rows === null ? (
        /* The same rows, as shapes, so the panel is its final height while
           the names arrive and nothing under it jumps. */
        <ul className="mini-list divide-y divide-line" aria-busy data-lenis-prevent>
          {wanted.map((id) => (
            <li key={id} className="flex gap-3 px-4 py-3">
              <span className="skeleton h-14 w-14 shrink-0 rounded-control" />
              <span className="flex flex-1 flex-col gap-2 py-1">
                <span className="skeleton h-3 w-3/4 rounded-sm" />
                <span className="skeleton h-3 w-1/3 rounded-sm" />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="mini-list divide-y divide-line" data-lenis-prevent>
          {rows.map((product) => {
            const name = locale === "ka" ? product.nameKa : product.nameEn;
            return (
              <li key={product.id} className="flex items-center gap-3 px-4 py-3">
                <Link
                  href={`/product/${product.slug}`}
                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-control border border-line bg-ink-50"
                >
                  <Image src={product.image} alt="" fill sizes="56px" className="object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/product/${product.slug}`}
                    className="clamp-2-xs text-xs leading-snug font-semibold text-ink-900 hover:text-brand-600"
                  >
                    {name}
                  </Link>
                  <div className="mt-1">
                    <Price value={product.price} oldValue={product.oldPrice} size="sm" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(product.id)}
                  aria-label={`${t.favorites.remove} — ${name}`}
                  className="btn btn-ghost -mr-1.5 h-7 w-7 min-h-0 shrink-0 rounded-control p-0 text-ink-400 hover:text-danger"
                >
                  <CloseIcon size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* The same foot as the cart's — a figure and a row of buttons — so
          the two panels are one size. The figure is what the list would
          cost, which is the one thing a wishlist is asked. */}
      <div className="border-t border-line bg-canvas px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-ink-500">{t.favorites.worth}</span>
          <span className="text-base font-extrabold text-ink-900 tabular-nums">
            {rows ? formatPrice(rows.reduce((sum, product) => sum + product.price, 0), locale) : "…"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
          <Link href="/favorites" className="btn btn-outline btn-sm">
            {t.home.viewAll}
          </Link>
          <Link href="/catalog" className="btn btn-primary btn-sm">
            {t.catalog.title}
          </Link>
        </div>
      </div>
    </>
  );
}
