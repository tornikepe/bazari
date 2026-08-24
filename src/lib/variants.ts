/**
 * Size and colour, as the shop states them and as a shopper picks them.
 *
 * Nothing is imported here on purpose. The product page needs this in the
 * browser to work out which combination a pair of dropdowns adds up to, and
 * `placeOrder` needs the same answer on the server before it charges anybody —
 * and two implementations of "which variant is this?" is the sort of pair that
 * agrees until the day it does not.
 *
 * A product with no options is not a special case anywhere below. It has no
 * variants, `variantFor` is never asked, and every price and stock figure
 * comes from the product itself exactly as it did before variants existed.
 */

export type OptionValue = { id: string; label: string };
export type Option = { id: string; name: string; values: OptionValue[] };

export type Variant = {
  id: string;
  sku: string;
  /** Tetri, or null to mean "whatever the product costs". */
  price: number | null;
  stock: number;
  isActive: boolean;
  /** The value ids that make up this combination, one per option. */
  valueIds: string[];
};

/** A choice in progress: option id → chosen value id. */
export type Chosen = Record<string, string | undefined>;

/**
 * The combination a set of choices adds up to, or nothing.
 *
 * Nothing is the honest answer while a shopper is still choosing, and it is
 * also the answer for a pair that was never generated — a shop can switch off
 * "Red / XL" without deleting the colour or the size.
 */
export function variantFor(variants: Variant[], chosen: Chosen): Variant | null {
  const picked = Object.values(chosen).filter((id): id is string => Boolean(id));
  if (picked.length === 0) return null;

  return (
    variants.find(
      (variant) =>
        variant.valueIds.length === picked.length &&
        picked.every((id) => variant.valueIds.includes(id)),
    ) ?? null
  );
}

/** Whether every option has been answered. */
export function isComplete(options: Option[], chosen: Chosen): boolean {
  return options.every((option) => Boolean(chosen[option.id]));
}

/**
 * What a variant costs, in tetri.
 *
 * The product's price is the default and the variant's is an override, rather
 * than the variant carrying a delta. A delta reads well until the product is
 * repriced and every variant quietly moves with it — which is right for "＋₾5
 * for XL" and wrong for "the red one is last season's price".
 */
export function priceOf(productPrice: number, variant: Variant | null): number {
  return variant?.price ?? productPrice;
}

/**
 * What is on the shelf: the variant's own figure, or the product's when there
 * are no variants at all.
 */
export function stockOf(productStock: number, variants: Variant[], variant: Variant | null): number {
  if (variants.length === 0) return productStock;
  return variant?.stock ?? 0;
}

/** The product's stock when it has variants: the sum of what can be bought. */
export function totalStock(variants: Variant[]): number {
  return variants.reduce((sum, variant) => sum + (variant.isActive ? variant.stock : 0), 0);
}

/**
 * What to call a combination in a cart line, an order and an email.
 *
 * Joined with a middle dot rather than a slash: a slash inside "S / Red" reads
 * as a fraction next to a price, and the same character already separates the
 * breadcrumb.
 */
export function labelFor(options: Option[], variant: Variant): string {
  return options
    .map((option) => option.values.find((value) => variant.valueIds.includes(value.id))?.label)
    .filter((label): label is string => Boolean(label))
    .join(" · ");
}

/**
 * Every combination of the given options, in the order a person reads them.
 *
 * The first option varies slowest, so "S · Red, S · Blue, M · Red…" — which is
 * how somebody scanning a table of six rows expects to find one.
 */
export function combinations(options: Option[]): string[][] {
  return options.reduce<string[][]>(
    (rows, option) => rows.flatMap((row) => option.values.map((value) => [...row, value.id])),
    [[]],
  );
}
