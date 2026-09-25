"use client";

import { useEffect, useState } from "react";
import { useCart, type CartItem } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { SizeSelect } from "@/components/product/SizeSelect";
import { LineDetails } from "@/components/cart/LineDetails";
import { lineKey } from "@/lib/cart-store";
import { labelFor, priceOf, variantFor, type Chosen, type Option, type Variant } from "@/lib/variants";

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
 * What a cart line is — its size, its colour, whatever the shop sells it
 * by — changed on the line itself. The card and the product page put the
 * first combination in without asking, and this is where it is corrected.
 *
 * One control per option rather than one listing every combination. A
 * shoe sold in eleven sizes and three colours is thirty-three rows in a
 * single list and two short lists here, and the shop can add a third
 * option tomorrow without this needing to know. A value that leads to a
 * combination the shop never made is struck through, exactly as on the
 * product page — the two ask the same question, so they ask it the same
 * way.
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

  /* Nothing to pick from until it has arrived, or ever: the line says
     what it is in words instead. */
  if (!data || failed || data.options.length === 0 || data.variants.length === 0) {
    return item.variantLabel ? (
      <span className="line-cell is-details">
        <LineDetails label={item.variantLabel} />
      </span>
    ) : null;
  }

  /* What this line is now, read back off its own variant: option id →
     value id, which is the shape the pickers and `variantFor` speak. */
  const current = data.variants.find((variant) => variant.id === item.variantId) ?? null;
  const chosen: Chosen = {};
  for (const option of data.options) {
    chosen[option.id] = option.values.find((value) => current?.valueIds.includes(value.id))?.id;
  }

  /** Whether picking this value could still land on something the shop made. */
  function reachable(optionId: string, valueId: string) {
    const attempt = { ...chosen, [optionId]: valueId };
    const picked = Object.values(attempt).filter((id): id is string => Boolean(id));
    return (data as Loaded).variants.some(
      (candidate) => candidate.isActive && candidate.stock > 0 && picked.every((id) => candidate.valueIds.includes(id)),
    );
  }

  function pick(optionId: string, valueId: string) {
    const variant = variantFor((data as Loaded).variants, { ...chosen, [optionId]: valueId });
    if (!variant) return;
    replace(lineKey(item), {
      ...item,
      price: priceOf((data as Loaded).price, variant),
      stock: variant.stock,
      variantId: variant.id,
      variantLabel: labelFor((data as Loaded).options, variant),
    });
  }

  return (
    /* One cell however many questions the product asks: the controls sit
       side by side down the middle of it, and wrap when there is no room
       for two. */
    <span className="line-cell is-details">
      <span className="line-details">
        {data.options.map((option) => (
          <SizeSelect
            key={option.id}
            label={option.name}
            soldOutLabel={t.product.outOfStock}
            value={chosen[option.id]}
            choices={option.values.map((value) => ({
              id: value.id,
              label: value.label,
              available: reachable(option.id, value.id),
            }))}
            onChange={(valueId) => pick(option.id, valueId)}
          />
        ))}
      </span>
    </span>
  );
}
