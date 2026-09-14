"use client";

import type { ReactNode } from "react";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { lineKey } from "@/lib/cart-store";
import { CartIcon, CheckIcon } from "@/components/ui/icons";

/**
 * One button, two states, and the second undoes the first: not in the cart,
 * a press adds it; in the cart, the button says so and a press takes it out
 * again. It used to add on every press and flash "added" for a second and a
 * half, which read as a toggle that had failed — a shopper who pressed twice
 * to undo had two in the cart and no way to see it from here.
 *
 * The state is the cart's own, read through the store, so a card in the
 * catalogue agrees with the product page and with the cart itself, and it
 * survives navigating away and back. Before hydration the cart is unknown
 * and the button shows "add" — the same thing the server rendered.
 *
 * Every label the button can show is laid out in the same grid cell, the
 * hidden ones invisible, so the button is always as wide and as tall as its
 * longest label. Without that, "კალათაში დამატება" wrapped onto two lines on
 * a phone-width card and "კალათაშია" did not, and each press moved the
 * delivery line above it by a row.
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
  const { items, hydrated, add, remove } = useCart();
  const { t } = useI18n();

  const key = lineKey(product);
  const inCart = hydrated && items.some((entry) => lineKey(entry) === key);
  const soldOut = product.stock <= 0;

  function handleClick() {
    if (soldOut) return;
    if (inCart) remove(key);
    else add(product, quantity);
  }

  const label = soldOut
    ? t.product.outOfStock
    : inCart
      ? t.product.inCart
      : t.product.addToCart;

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
        inCart
          ? "btn-secondary"
          : variant === "primary"
            ? "btn-primary"
            : "btn-outline",
        fullWidth ? "w-full" : "",
      ].join(" ")}
    >
      <span className="grid">
        {/* The icon travels with its label inside each layer, so the pair is
            centred as one and the check does not sit a word's width from
            "in the cart" — the width of the label it replaced. */}
        <Layer
          icon={showIcon && <CartIcon size={16} className="shrink-0" />}
          hidden
        >
          {t.product.addToCart}
        </Layer>
        <Layer
          icon={showIcon && <CheckIcon size={16} className="shrink-0" />}
          hidden
        >
          {t.product.inCart}
        </Layer>
        <Layer
          icon={
            showIcon &&
            (inCart ? (
              <CheckIcon size={16} className="shrink-0" />
            ) : (
              <CartIcon size={16} className="shrink-0" />
            ))
          }
        >
          {label}
        </Layer>
      </span>
    </button>
  );
}

function Layer({
  icon,
  hidden = false,
  children,
}: {
  icon: ReactNode;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden={hidden || undefined}
      className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${
        hidden ? "invisible" : ""
      }`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
