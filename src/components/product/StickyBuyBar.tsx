"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Price } from "@/components/ui/Price";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { useI18n } from "@/components/providers/I18nProvider";
import type { CartItem } from "@/components/providers/CartProvider";

/**
 * A compact buy bar that appears once the real purchase panel scrolls away.
 *
 * The product page is long — description, guarantees, related products — and
 * on a phone the add-to-cart button is off screen for most of it. Rather than
 * pinning the panel itself (which would eat a third of a small screen), this
 * shows a single row with the price and one button, and only while the panel
 * is out of view.
 *
 * `IntersectionObserver` rather than a scroll listener: the browser does the
 * work off the main thread, and there is no throttling to get wrong.
 *
 * The bar reports its own height as `--buy-bar-h` on the document, which is
 * what the chat launcher reads to lift itself out of the way. Two fixed
 * elements in the same corner otherwise cover each other, and the one that
 * loses is whichever happens to come later in the stylesheet.
 */
export function StickyBuyBar({
  product,
  /** The element to watch — the real purchase panel. */
  watchId,
}: {
  product: Omit<CartItem, "quantity">;
  watchId: string;
}) {
  const { locale, t } = useI18n();
  const [shown, setShown] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const name = locale === "ka" ? product.nameKa : product.nameEn;
  const soldOut = product.stock <= 0;

  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        // Only once the panel has left upwards. Showing it while the panel is
        // still below the fold would mean two add-to-cart buttons on screen
        // before the visitor has even reached the first one.
        setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);

  // Publish the height so the chat launcher can sit above it, and clear it on
  // the way out — a stale value would leave the launcher floating.
  useEffect(() => {
    const root = document.documentElement;
    if (shown && barRef.current) {
      root.style.setProperty("--buy-bar-h", `${barRef.current.offsetHeight}px`);
    } else {
      root.style.removeProperty("--buy-bar-h");
    }
    return () => {
      root.style.removeProperty("--buy-bar-h");
    };
  }, [shown]);

  return (
    <div
      ref={barRef}
      // Kept mounted and moved out of the layer rather than unmounted, so the
      // transition has something to animate from and the height can be read.
      data-shown={shown}
      aria-hidden={!shown}
      className="buy-bar"
    >
      <div className="page-container flex items-center gap-3 py-2.5">
        <div className="relative hidden h-11 w-11 shrink-0 overflow-hidden rounded-control bg-ink-50 sm:block">
          <Image src={product.image} alt="" fill sizes="44px" className="object-cover" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink-900">{name}</p>
          <Price value={product.price} size="sm" />
        </div>

        <AddToCartButton
          product={product}
          size="md"
          showIcon={false}
          // Never a focus target while hidden — a keyboard user tabbing the
          // page must not land on a button they cannot see.
          disabled={!shown}
        />

        {soldOut && <span className="sr-only">{t.product.outOfStock}</span>}
      </div>
    </div>
  );
}
