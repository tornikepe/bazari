"use client";

import { useEffect, useRef, useState } from "react";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { lineKey } from "@/lib/cart-store";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";

/**
 * The buying controls, laid out as the reference shop lays them: the
 * choice (a size, passed in as `choice`) and the quantity on one row, the
 * wide dark "add to cart" with the heart square beside it under that, and
 * "buy now" as a quiet line under those.
 *
 * On a phone the two buttons are also a bar fixed to the foot of the
 * screen, always — the same buttons, the same state, drawn twice; the
 * inline pair is hidden there. The bar reports its height as
 * `--buy-bar-h` so the chat launcher lifts clear of it.
 *
 * The stepper is the cart's own quantity once the product is in the cart,
 * and the quantity to add until then.
 */
export function ProductPurchasePanel({
  product,
  keepShape = false,
  prompt,
  choice,
}: {
  product: Omit<CartItem, "quantity">;
  /** Keep the stepper in place, disabled, when a size is sold out. */
  keepShape?: boolean;
  /** Passed through to the add button: what it says while there is no choice yet. */
  prompt?: string;
  /** The size selector, when the product is sold in sizes. */
  choice?: React.ReactNode;
}) {
  const { t } = useI18n();
  const { items, hydrated, add, setQuantity: setLineQuantity } = useCart();
  const [pending, setPending] = useState(1);
  const bar = useRef<HTMLDivElement>(null);

  const key = lineKey(product);
  const line = hydrated && !prompt ? items.find((entry) => lineKey(entry) === key) : undefined;
  const quantity = line ? line.quantity : pending;

  const soldOut = product.stock <= 0;
  const max = Math.max(1, product.stock);

  function setQuantity(next: number) {
    const value = Math.min(Math.max(1, next), max);
    if (line) setLineQuantity(key, value);
    else setPending(value);
  }

  /* The bar's height, for the chat launcher — measured, since the button
     wraps on the narrowest phones. */
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const root = document.documentElement;
    const write = () => {
      if (getComputedStyle(el).display === "none") root.style.removeProperty("--buy-bar-h");
      else root.style.setProperty("--buy-bar-h", `${el.offsetHeight}px`);
    };
    write();
    const ro = new ResizeObserver(write);
    ro.observe(el);
    window.addEventListener("resize", write);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", write);
      root.style.removeProperty("--buy-bar-h");
    };
  }, []);

  const buttons = (
    <div className="flex items-stretch gap-2">
      <AddToCartButton product={product} quantity={quantity} size="lg" fullWidth prompt={prompt} />
      <FavoriteButton productId={product.productId} size="control" />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* The choice and the quantity on one row. */}
      {(!soldOut || keepShape) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {choice}
          <div>
            <span className="field-label">{t.product.quantity}</span>
            {/* Two round marks and the number between them, in a box the
                height of the size control beside it. */}
            <div className="qty">
              <button
                type="button"
                onClick={() => setQuantity(quantity - 1)}
                disabled={soldOut || quantity <= 1}
                aria-label="-"
                className="qty-button"
              >
                <MinusIcon size={16} strokeWidth={2.5} />
              </button>
              <input
                type="number"
                value={quantity}
                min={1}
                max={max}
                disabled={soldOut}
                onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                aria-label={t.product.quantity}
                className="qty-value"
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                disabled={soldOut || quantity >= max}
                aria-label="+"
                className="qty-button"
              >
                <PlusIcon size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:block">{buttons}</div>

      {/* The phone's foot bar: the same two buttons, fixed. */}
      <div ref={bar} className="buy-foot lg:hidden">
        {buttons}
      </div>
    </div>
  );
}
