"use client";

import { useEffect, useRef, useState } from "react";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { CartIcon, CheckIcon } from "@/components/ui/icons";

/**
 * Adds to the cart and flips to a confirmed state for a moment. The timeout is
 * cleared on unmount so a card removed mid-animation can't setState after.
 */
export function AddToCartButton({
  product,
  quantity = 1,
  size = "sm",
  variant = "primary",
  fullWidth = false,
  showIcon = true,
}: {
  product: Omit<CartItem, "quantity">;
  quantity?: number;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "outline";
  fullWidth?: boolean;
  showIcon?: boolean;
}) {
  const { add } = useCart();
  const { t } = useI18n();
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const soldOut = product.stock <= 0;

  function handleClick() {
    if (soldOut) return;

    add(product, quantity);
    setJustAdded(true);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setJustAdded(false), 1600);
  }

  const label = soldOut ? t.product.outOfStock : justAdded ? t.product.added : t.product.addToCart;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={soldOut}
      aria-live="polite"
      className={[
        "btn",
        `btn-${size}`,
        justAdded ? "btn-secondary" : variant === "primary" ? "btn-primary" : "btn-outline",
        fullWidth ? "w-full" : "",
      ].join(" ")}
    >
      {showIcon &&
        (justAdded ? <CheckIcon size={16} /> : <CartIcon size={16} />)}
      {label}
    </button>
  );
}
