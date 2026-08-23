"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { ProductCard } from "@/components/product/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PRODUCT_GRID_WIDE } from "@/components/ui/ProductGridSkeleton";
import type { ProductCardData } from "@/lib/catalog";
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
} from "@/lib/recently-viewed-store";

/**
 * The products this browser looked at, drawn from live data.
 *
 * The list is in `localStorage`, so this cannot be server-rendered — but what
 * is stored is only ids, and the cards are fetched. A row rendered straight
 * out of storage would show last week's price and go on offering something
 * the shop has withdrawn.
 *
 * Nothing is drawn until there is something to draw: no heading, no skeleton,
 * no empty box. A first-time visitor should not be shown the outline of a
 * feature that has nothing to say to them.
 */
export function RecentlyViewed({
  exclude,
  take = 4,
}: {
  /** The product being looked at now — it is not "recently viewed". */
  exclude?: string;
  take?: number;
}) {
  const { t } = useI18n();
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  /* The answer is stored *with* the question it answers, so "is this list the
     one we asked for" is a render-time comparison rather than something an
     effect has to keep in step. Clearing it on a change would be a `setState`
     inside an effect — a cascading render, and one frame of the wrong row. */
  const [answer, setAnswer] = useState<{ key: string; products: ProductCardData[] }>({
    key: "",
    products: [],
  });

  const wanted = ids.filter((id) => id !== exclude).slice(0, take);
  const key = wanted.join(",");

  useEffect(() => {
    if (!key) return;

    // Abandoned on unmount and on a change of list, so a slow answer for the
    // previous product cannot arrive after the next one has been drawn.
    const controller = new AbortController();

    fetch(`/api/products?ids=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { products: [] }))
      .then((data: { products?: ProductCardData[] }) =>
        setAnswer({ key, products: data.products ?? [] }),
      )
      .catch(() => {
        // A failed lookup means no row. There is nothing here worth an error
        // message — the visitor did not ask for this section.
      });

    return () => controller.abort();
  }, [key]);

  const products = answer.key === key ? answer.products : [];

  if (products.length === 0) return null;

  return (
    <section className="mt-12">
      <SectionHeading title={t.product.recentlyViewed} />
      <div className={PRODUCT_GRID_WIDE}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
