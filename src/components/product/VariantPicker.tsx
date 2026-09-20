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

  /* The choice as a select, one per option, the way the reference shop
     asks for a size: a control that opens rather than a row of buttons.
     A combination that was never generated, or is gone, is offered but
     marked, so a shopper who picks it is told rather than handed another. */
  const selects = options.map((option) => (
    <div key={option.id}>
      <label className="field-label" htmlFor={`option-${option.id}`}>
        {option.name}
      </label>
      <select
        id={`option-${option.id}`}
        value={chosen[option.id] ?? ""}
        onChange={(event) =>
          setChosen((current) => ({ ...current, [option.id]: event.target.value || undefined }))
        }
        className="field h-[3.25rem] text-base font-semibold"
      >
        <option value="">{fill(t.product.chooseOption, { name: option.name.toLowerCase() })}</option>
        {option.values.map((value) => (
          <option key={value.id} value={value.id} disabled={!reachable(option.id, value.id)}>
            {value.label}
            {reachable(option.id, value.id) ? "" : ` — ${t.product.outOfStock}`}
          </option>
        ))}
      </select>
    </div>
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

      {/* What the choice adds up to, said once. */}
      {complete && (
        <p
          role="status"
          className={`flex items-center gap-1.5 text-sm font-semibold ${stock > 0 ? "text-success" : "text-danger"}`}
        >
          {stock > 0 ? <CheckIcon size={14} /> : <CloseIcon size={14} />}
          {stock > 0 ? fill(t.product.variantPicked, { label: labelFor(options, variant!) }) : t.product.variantGone}
        </p>
      )}
    </div>
  );
}
