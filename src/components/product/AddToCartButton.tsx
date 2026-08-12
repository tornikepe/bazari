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
  disabled = false,
}: {
  product: Omit<CartItem, "quantity">;
  quantity?: number;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "outline";
  fullWidth?: boolean;
  showIcon?: boolean;
  /** Separate from sold-out: used to take a hidden copy out of the tab order. */
  disabled?: boolean;
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
      disabled={soldOut || disabled}
      // No `aria-live` here on purpose. It used to be, and a live region on the
      // control whose own label is changing announces the label rather than the
      // event — and only while that button is on screen, so removing an item
      // from the cart page said nothing. `CartAnnouncer` owns this now.
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
