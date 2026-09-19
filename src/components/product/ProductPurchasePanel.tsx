"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { lineKey } from "@/lib/cart-store";
import { fill } from "@/lib/i18n";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";

/**
 * Quantity stepper plus the two purchase buttons.
 *
 * The stepper is the cart's own quantity once the product is in the cart,
 * and the quantity to add until then. The add button is a toggle now — in
 * the cart, a press takes the product out — so the only other way to buy
 * three instead of one from this page is for the stepper to edit the line
 * itself, which is what a shopper pressing "+" beside a button that says
 * "in the cart" expects it to do.
 */
export function ProductPurchasePanel({
  product,
  keepShape = false,
  prompt,
}: {
  product: Omit<CartItem, "quantity">;
  /**
   * Keep the stepper and "buy now" in place, disabled, when the product is
   * sold out. A product sold in one form that is out of stock simply has
   * less to offer and the panel says so; a product sold in sizes changes
   * `product` with every choice, and a panel that folded two controls away
   * for a sold-out size and unfolded them for the next moved everything
   * under it each time.
   */
  keepShape?: boolean;
  /** Passed through to the add button: what it says while there is no choice yet. */
  prompt?: string;
}) {
  const { t } = useI18n();
  const { items, hydrated, add, setQuantity: setLineQuantity } = useCart();
  const router = useRouter();
  const [pending, setPending] = useState(1);

  const key = lineKey(product);
  const line =
    hydrated && !prompt
      ? items.find((entry) => lineKey(entry) === key)
      : undefined;
  const quantity = line ? line.quantity : pending;

  const soldOut = product.stock <= 0;
  const max = Math.max(1, product.stock);

  function clamp(next: number) {
    return Math.min(Math.max(1, next), max);
  }

  function setQuantity(next: number) {
    const value = clamp(next);
    if (line) setLineQuantity(key, value);
    else setPending(value);
  }

  function buyNow() {
    if (soldOut) return;
    if (!line) add(product, quantity);
    router.push("/checkout");
  }

  return (
    <div className="flex flex-col gap-3">
      {(!soldOut || keepShape) && (
        /* The label above; the stepper, the count and the heart on the line
           under it. All four shared one line, and on a phone they shared
           330px by shrinking — the stepper to a third of its width, its
           buttons to slivers. Nothing on the line shrinks now. */
        <div>
          <span className="field-label">{t.product.quantity}</span>
          <div className="flex items-center gap-3">

          {/* A stepper: minus, the number, plus, as one control the height
              of the buttons under it. The number is a field, so it can also
              be typed; the stock is the ceiling on both. */}
          <div className="stepper shrink-0">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={soldOut || quantity <= 1}
              aria-label="-"
              className="stepper-button"
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
              className="stepper-value"
            />

            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              disabled={soldOut || quantity >= max}
              aria-label="+"
              className="stepper-button"
            >
              <PlusIcon size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* The product's own heart, at the end of the quantity row rather
              than as a third button: beside two wide buttons it squeezed
              the first until its label broke across two lines. */}
          {/* How many there are to have, so "+" stopping is explained. */}
          {!soldOut && (
            <span className="min-w-0 text-xs text-ink-400 tabular-nums">
              {fill(t.product.inStockCount, { count: product.stock })}
            </span>
          )}

          <FavoriteButton productId={product.productId} size="control" className="ml-auto" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <AddToCartButton
          product={product}
          quantity={quantity}
          size="lg"
          fullWidth
          prompt={prompt}
        />

        {(!soldOut || keepShape) && (
          <button
            type="button"
            onClick={buyNow}
            disabled={soldOut}
            className="btn btn-secondary btn-lg w-full"
          >
            {t.product.buyNow}
          </button>
        )}
      </div>
    </div>
  );
}
