"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import type { CartItem } from "@/components/providers/CartProvider";
import { isComplete, labelFor, priceOf, variantFor, type Option, type Variant } from "@/lib/variants";
import { Price } from "@/components/ui/Price";
import { CloseIcon } from "@/components/ui/icons";
import { SizeSelect } from "@/components/product/SizeSelect";
import { fill } from "@/lib/i18n";

/**
 * Choosing a size and a colour, and buying the one that results.
 *
 * The price and the stock move with the choice, because for a product sold in
 * two forms at two prices, the number beside the title before anything is
 * chosen is not the price of anything. So the panel shows the product's price
 * until a combination is complete and the combination's afterwards.
 *
 * The choice is the shop's own control rather than the platform's select:
 * a button that opens a panel of the sizes, where a sold-out one can say so
 * in the shop's own hand instead of disappearing into an operating system's
 * wheel.
 *
 * A combination that was never generated is unselectable rather than absent: a
 * shop can stop making "Red / XL" without withdrawing red or XL, and a shopper
 * pressing XL after red should be told that pair is gone, not silently handed
 * a different one.
 */
export function VariantPicker({
  product,
  options,
  variants,
}: {
  /** The line as it would be without variants — name, image, slug, base price. */
  product: Omit<CartItem, "quantity">;
  options: Option[];
  variants: Variant[];
}) {
  const { t } = useI18n();
  /* A size from the start — the first that can be bought — the way the
     reference shop opens on "S". A blank "choose a size" was one more
     press before every purchase, and a thing a shopper could pick. */
  const [chosen, setChosen] = useState<Record<string, string | undefined>>(() => {
    const first: Record<string, string | undefined> = {};
    for (const option of options) {
      first[option.id] = option.values.find((value) =>
        variants.some((candidate) => candidate.isActive && candidate.stock > 0 && candidate.valueIds.includes(value.id)),
      )?.id ?? option.values[0]?.id;
    }
    return first;
  });

  /* "Choose a size", naming the thing still to be chosen, rather than
     "choose a variant" — nobody buying shoes thinks of a size as a variant. */
  const missing = options.filter((option) => !chosen[option.id]).map((option) => option.name);
  const prompt = fill(t.product.chooseOption, { name: missing.join(" / ").toLowerCase() || options[0]?.name || "" });

  const variant = variantFor(variants, chosen);
  const complete = isComplete(options, chosen);
  const price = priceOf(product.price, variant);

  /* Only when every question has been answered. A partial choice matches
     several combinations, and the stock of "whichever of those came first" is
     a number about nothing. */
  const stock = complete ? (variant?.isActive ? variant.stock : 0) : 0;

  /** Whether picking this value could still lead to something buyable. */
  function reachable(optionId: string, valueId: string): boolean {
    const attempt = { ...chosen, [optionId]: valueId };
    const picked = Object.entries(attempt)
      .filter(([, id]) => Boolean(id))
      .map(([, id]) => id as string);

    return variants.some(
      (candidate) => candidate.isActive && picked.every((id) => candidate.valueIds.includes(id)),
    );
  }

  /* The choice as the shop's own control, one per option: a button that
     opens a panel of the sizes, with the ones that cannot be bought
     struck through — a shopper who picks a gone pair is told rather than
     handed another. */
  const selects = options.map((option) => (
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
      onChange={(valueId) => setChosen((current) => ({ ...current, [option.id]: valueId }))}
    />
  ));

  return (
    <div className="flex flex-col gap-4">
      {/* The price, restated where the choice is made — it is the thing the
          choice changes. Only when a variant is priced on its own. */}
      {variants.some((candidate) => candidate.price != null && candidate.price !== product.price) && (
        <div
          className={complete && variant && price !== product.price ? "" : "invisible"}
          aria-hidden={!(complete && variant && price !== product.price)}
        >
          <Price value={price} size="lg" />
        </div>
      )}

      <ProductPurchasePanel
        /* A sold-out size must not fold the stepper and "buy now" away:
           the panel would change shape with every choice. */
        keepShape
        prompt={complete ? undefined : prompt}
        choice={<>{selects}</>}
        product={{
          ...product,
          price,
          stock,
          variantId: variant?.id,
          variantLabel: variant ? labelFor(options, variant) : undefined,
        }}
      />

      {/* Only when the pair chosen cannot be bought: the select already
          says what was chosen. */}
      {complete && stock <= 0 && (
        <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-danger">
          <CloseIcon size={14} />
          {t.product.variantGone}
        </p>
      )}
    </div>
  );
}
