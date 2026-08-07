import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";

/**
 * What delivery costs.
 *
 * These used to be two module constants, which was fine while they could never
 * change and wrong the moment they could. They are now a value that travels:
 * read from settings on the server, from `useSettings()` on the client, and
 * passed into the one function that applies them.
 *
 * The constants survive as the fallback, so a caller that genuinely has no
 * settings to hand — a unit test, a pure calculation — still gets the shop's
 * defaults rather than zero.
 */
export type ShippingRules = {
  /** Tetri. At or above this, delivery is free. */
  freeShippingThreshold: number;
  /** Tetri. Charged below the threshold. */
  shippingFee: number;
};

export const DEFAULT_SHIPPING: ShippingRules = {
  freeShippingThreshold: DEFAULT_SETTINGS.freeShippingThreshold,
  shippingFee: DEFAULT_SETTINGS.shippingFee,
};

/**
 * The single place the rule is applied.
 *
 * It was written out three times — in the cart store, in the cart view and in
 * `placeOrder` — which is three chances for the price a shopper is shown to
 * disagree with the price they are charged.
 *
 * An empty basket ships for nothing: charging delivery on nothing is a bug
 * people notice immediately.
 */
export function shippingFor(
  subtotal: number,
  itemCount: number,
  rules: ShippingRules = DEFAULT_SHIPPING,
) {
  if (itemCount === 0) return 0;
  return subtotal >= rules.freeShippingThreshold ? 0 : rules.shippingFee;
}
