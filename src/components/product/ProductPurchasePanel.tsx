"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { FavoriteButton } from "@/components/product/FavoriteButton";
import { lineKey } from "@/lib/cart-store";
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
    hydrated && !prompt ? items.find((entry) => lineKey(entry) === key) : undefined;
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
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-700">
            {t.product.quantity}
          </span>

          <div className="flex items-center rounded-control border border-line bg-surface">
            <button
              type="button"
              onClick={() => setQuantity(quantity - 1)}
              disabled={soldOut || quantity <= 1}
              aria-label="-"
              className="btn btn-ghost h-10 w-10 rounded-none rounded-l-control p-0"
            >
              <MinusIcon size={15} />
            </button>

            <input
              type="number"
              value={quantity}
              min={1}
              max={max}
              disabled={soldOut}
              onChange={(event) => setQuantity(Number(event.target.value) || 1)}
              aria-label={t.product.quantity}
              className="h-10 w-14 border-x border-line bg-transparent text-center text-sm font-semibold outline-none"
            />

            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              disabled={soldOut || quantity >= max}
              aria-label="+"
              className="btn btn-ghost h-10 w-10 rounded-none rounded-r-control p-0"
            >
              <PlusIcon size={15} />
            </button>
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

        {/* The product's own heart. Every card in the shop had one and the
            product's own page did not, so the one place a shopper had read
            enough to decide was the one place they could not save it. Sized
            to the buttons beside it rather than to the chip on a card. */}
        <FavoriteButton productId={product.productId} size="control" />
      </div>
    </div>
  );
}
