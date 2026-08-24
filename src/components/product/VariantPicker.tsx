"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import type { CartItem } from "@/components/providers/CartProvider";
import { isComplete, labelFor, priceOf, variantFor, type Option, type Variant } from "@/lib/variants";
import { Price } from "@/components/ui/Price";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import { fill } from "@/lib/i18n";

/**
 * Choosing a size and a colour, and buying the one that results.
 *
 * The price and the stock move with the choice, because for a product sold in
 * two forms at two prices, the number beside the title before anything is
 * chosen is not the price of anything. So the panel shows the product's price
 * until a combination is complete and the combination's afterwards.
 *
 * Buttons rather than dropdowns. Two of them is a dropdown's worth of clicks
 * with none of the opening, and a sold-out size can say so where it stands
 * instead of hiding inside a list — which is the one thing a shopper most
 * wants to know before they have picked anything.
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
  const [chosen, setChosen] = useState<Record<string, string | undefined>>({});

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

  return (
    <div className="flex flex-col gap-4">
      {/* The price, restated where the choice is made — it is the thing the
          choice changes, and the figure beside the title is now a starting
          point rather than an answer. */}
      {complete && variant && price !== product.price && (
        <div>
          <Price value={price} size="lg" />
        </div>
      )}

      {options.map((option) => (
        <fieldset key={option.id}>
          <legend className="field-label">{option.name}</legend>

          <div className="mt-1.5 flex flex-wrap gap-2">
            {option.values.map((value) => {
              const picked = chosen[option.id] === value.id;
              const possible = reachable(option.id, value.id);

              return (
                <button
                  key={value.id}
                  type="button"
                  aria-pressed={picked}
                  disabled={!possible}
                  onClick={() =>
                    setChosen((current) => ({
                      ...current,
                      [option.id]: current[option.id] === value.id ? undefined : value.id,
                    }))
                  }
                  className={`min-h-10 rounded-control border px-3 text-sm font-semibold transition-colors ${
                    picked
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : possible
                        ? "border-line text-ink-700 hover:border-ink-300"
                        : "border-line text-ink-300 line-through"
                  }`}
                >
                  {value.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      {/* What the choice adds up to, said once rather than left to be inferred
          from a disabled button. */}
      <p
        role="status"
        className={`text-sm font-semibold ${
          !complete ? "text-ink-500" : stock > 0 ? "text-success" : "text-danger"
        }`}
      >
        {!complete ? (
          t.product.variantChoose
        ) : stock > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon size={14} />
            {fill(t.product.variantPicked, { label: labelFor(options, variant!) })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <CloseIcon size={14} />
            {t.product.variantGone}
          </span>
        )}
      </p>

      <ProductPurchasePanel
        product={{
          ...product,
          price,
          stock,
          variantId: variant?.id,
          variantLabel: variant ? labelFor(options, variant) : undefined,
        }}
      />
    </div>
  );
}
