"use client";

import { useEffect, useState } from "react";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { ChevronDownIcon } from "@/components/ui/icons";
import { lineKey } from "@/lib/cart-store";
import { labelFor, priceOf, type Option, type Variant } from "@/lib/variants";

type Loaded = { price: number; options: Option[]; variants: Variant[] };

/* Fetched once per product per page load, whatever the number of lines. */
const loaded = new Map<string, Promise<Loaded>>();

function loadVariants(productId: string, locale: "ka" | "en"): Promise<Loaded> {
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
 * The size of a cart line, as a select on the line itself: the cart is
 * where a size is chosen, since the card and the page put the first size
 * in without asking. Every size in stock is offered, each by the label
 * the product page would show; choosing one turns this line into that
 * size, folding into a line of it that is already there.
 */
export function LineSizePicker({ item }: { item: CartItem }) {
  const { t, locale } = useI18n();
  const { replace } = useCart();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadVariants(item.productId, locale)
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [item.productId, locale]);

  /* Nothing to pick from until it has arrived: the chip says the size. */
  if (!data || failed || data.variants.length === 0) {
    return item.variantLabel ? <span className="line-chip">{item.variantLabel}</span> : null;
  }

  const choices = data.variants.filter(
    (variant) => variant.isActive && (variant.stock > 0 || variant.id === item.variantId),
  );
  const name = data.options.map((option) => option.name).join(" · ");

  return (
    <span className="pick line-pick">
      <select
        value={item.variantId ?? ""}
        aria-label={name}
        onChange={(event) => {
          const variant = data.variants.find((candidate) => candidate.id === event.target.value);
          if (!variant) return;
          replace(lineKey(item), {
            ...item,
            price: priceOf(data.price, variant),
            stock: variant.stock,
            variantId: variant.id,
            variantLabel: labelFor(data.options, variant),
          });
        }}
      >
        {choices.map((variant) => (
          <option key={variant.id} value={variant.id} disabled={variant.stock <= 0}>
            {name}: {labelFor(data.options, variant)}
            {variant.stock <= 0 ? ` — ${t.product.outOfStock}` : ""}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={15} className="pick-chevron" aria-hidden="true" />
    </span>
  );
}
