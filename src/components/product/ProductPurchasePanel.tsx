"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { AddToCartButton } from "@/components/product/AddToCartButton";
import { MinusIcon, PlusIcon } from "@/components/ui/icons";

/** Quantity stepper plus the two purchase buttons. */
export function ProductPurchasePanel({ product }: { product: Omit<CartItem, "quantity"> }) {
  const { t } = useI18n();
  const { add } = useCart();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);

  const soldOut = product.stock <= 0;
  const max = Math.max(1, product.stock);

  function clamp(next: number) {
    return Math.min(Math.max(1, next), max);
  }

  function buyNow() {
    if (soldOut) return;
    add(product, quantity);
    router.push("/checkout");
  }

  return (
    <div className="flex flex-col gap-3">
      {!soldOut && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-700">{t.product.quantity}</span>

          <div className="flex items-center rounded-control border border-line bg-surface">
            <button
              type="button"
              onClick={() => setQuantity((current) => clamp(current - 1))}
              disabled={quantity <= 1}
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
              onChange={(event) => setQuantity(clamp(Number(event.target.value) || 1))}
              aria-label={t.product.quantity}
              className="h-10 w-14 border-x border-line bg-transparent text-center text-sm font-semibold outline-none"
            />

            <button
              type="button"
              onClick={() => setQuantity((current) => clamp(current + 1))}
              disabled={quantity >= max}
              aria-label="+"
              className="btn btn-ghost h-10 w-10 rounded-none rounded-r-control p-0"
            >
              <PlusIcon size={15} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <AddToCartButton product={product} quantity={quantity} size="lg" fullWidth />

        {!soldOut && (
          <button type="button" onClick={buyNow} className="btn btn-secondary btn-lg w-full">
            {t.product.buyNow}
          </button>
        )}
      </div>
    </div>
  );
}
