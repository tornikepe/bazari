"use client";

import { useState } from "react";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { lineKey } from "@/lib/cart-store";
import { labelFor, priceOf, type Option, type Variant } from "@/lib/variants";
import { CartIcon, CheckIcon } from "@/components/ui/icons";

type Line = Omit<CartItem, "quantity">;
type Loaded = { price: number; options: Option[]; variants: Variant[] };

/* Fetched once per product per page load — twelve cards of the same shoe
   in three colours would otherwise ask twelve times. */
const loaded = new Map<string, Promise<Loaded>>();

async function loadVariants(productId: string, locale: "ka" | "en"): Promise<Loaded> {
  const key = `${productId}:${locale}`;
  let pending = loaded.get(key);
  if (!pending) {
    pending = fetch(`/api/products/${productId}/variants`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(
        (data: {
          price: number;
          options: { id: string; nameKa: string; nameEn: string; values: { id: string; valueKa: string; valueEn: string }[] }[];
          variants: Variant[];
        }) => ({
          price: data.price,
          options: data.options.map((option) => ({
            id: option.id,
            name: locale === "ka" ? option.nameKa : option.nameEn,
            values: option.values.map((value) => ({
              id: value.id,
              label: locale === "ka" ? value.valueKa : value.valueEn,
            })),
          })),
          variants: data.variants,
        }),
      );
    loaded.set(key, pending);
    pending.catch(() => loaded.delete(key));
  }
  return pending;
}

/**
 * The one button at the foot of a card: into the cart.
 *
 * A product sold in sizes is not asked which: the first size that is in
 * stock goes in, and the size can be changed on the cart page, where the
 * line has a picker of its own. The sizes are fetched when first asked
 * for, not shipped with every card. Pressed again, the button takes the
 * product out — every size of it.
 */
export function CardActions({
  product,
  needsChoice,
  look = "card",
}: {
  product: Line;
  needsChoice: boolean;
  /** `card`: the white pill over a picture. `plain`: an outlined button on paper. */
  look?: "card" | "plain";
}) {
  const { t, locale } = useI18n();
  const { items, hydrated, add, remove } = useCart();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const soldOut = product.stock <= 0;
  const lines = hydrated ? items.filter((entry) => entry.productId === product.productId) : [];
  const inCart = lines.length > 0;

  async function press() {
    if (soldOut || busy) return;
    if (inCart) {
      for (const line of lines) remove(lineKey(line));
      return;
    }
    if (!needsChoice) {
      add(product, 1);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const data = await loadVariants(product.productId, locale);
      const first = firstAvailable(data);
      if (!first) {
        setFailed(true);
        return;
      }
      add(
        {
          ...product,
          price: priceOf(data.price, first),
          stock: first.stock,
          variantId: first.id,
          variantLabel: labelFor(data.options, first),
        },
        1,
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={press}
      disabled={soldOut}
      aria-pressed={inCart}
      className={`btn w-full min-w-0 ${
        look === "card"
          ? `btn-sm px-2 shadow-pop ${inCart ? "btn-secondary" : "bg-surface text-ink-900 hover:bg-ink-900 hover:text-surface"}`
          : `btn-md ${inCart ? "btn-secondary" : "btn-outline"}`
      } ${failed ? "border-danger" : ""}`}
    >
      {inCart ? (
        <CheckIcon size={15} className="shrink-0" />
      ) : (
        <CartIcon size={15} className="shrink-0" />
      )}
      <span className="truncate">
        {soldOut ? t.product.outOfStock : inCart ? t.product.inCart : t.product.addToCartShort}
      </span>
    </button>
  );
}

/* The first size in stock, in the order the sizes are listed — the same
   one the product page preselects. */
function firstAvailable(data: Loaded): Variant | null {
  const order = data.options.flatMap((option) => option.values.map((value) => value.id));
  const live = data.variants.filter((variant) => variant.isActive && variant.stock > 0);
  live.sort((a, b) => {
    const ai = Math.min(...a.valueIds.map((id) => order.indexOf(id)));
    const bi = Math.min(...b.valueIds.map((id) => order.indexOf(id)));
    return ai - bi;
  });
  return live[0] ?? null;
}
