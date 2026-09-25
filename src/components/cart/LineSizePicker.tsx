"use client";

import { useEffect, useState } from "react";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { SizeSelect } from "@/components/product/SizeSelect";
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
    return item.variantLabel ? (
      <span className="line-cell is-size">
        <span className="line-chip">{item.variantLabel}</span>
      </span>
    ) : null;
  }

  const choices = data.variants.filter(
    (variant) => variant.isActive && (variant.stock > 0 || variant.id === item.variantId),
  );
  const name = data.options.map((option) => option.name).join(" · ");

  return (
    /* The shop's own control, the same one the product page opens — a
       button with a panel of sizes under it — rather than the platform's
       select. The word for what is being chosen sits over it, and both
       read down the middle of the cell. */
    <span className="line-cell is-size">
      <SizeSelect
        label={name}
        choices={choices.map((variant) => ({
          id: variant.id,
          label: labelFor(data.options, variant),
          available: variant.stock > 0,
        }))}
        value={item.variantId ?? undefined}
        soldOutLabel={t.product.outOfStock}
        onChange={(id) => {
          const variant = data.variants.find((candidate) => candidate.id === id);
          if (!variant) return;
          replace(lineKey(item), {
            ...item,
            price: priceOf(data.price, variant),
            stock: variant.stock,
            variantId: variant.id,
            variantLabel: labelFor(data.options, variant),
          });
        }}
      />
    </span>
  );
}
