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

/** A courier zone, as the rule needs it: what it costs, and when it is free. */
export type ZoneRules = {
  /** Tetri. */
  fee: number;
  /** Tetri. Null defers to the shop-wide threshold. */
  freeAbove: number | null;
};

/**
 * How the order leaves the shop.
 *
 * `courier` with no zone is the rule as it always was — one fee everywhere —
 * and is what a shop with no zones configured gets. A zone narrows it to a
 * place. `pickup` costs nothing, because nothing is sent.
 */
export type DeliveryChoice =
  | { method: "pickup" }
  | { method: "courier"; zone?: ZoneRules | null };

export const DEFAULT_DELIVERY: DeliveryChoice = { method: "courier" };

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
  choice: DeliveryChoice = DEFAULT_DELIVERY,
) {
  if (itemCount === 0) return 0;
  if (choice.method === "pickup") return 0;

  const zone = choice.zone;
  if (!zone) return subtotal >= rules.freeShippingThreshold ? 0 : rules.shippingFee;

  const threshold = zone.freeAbove ?? rules.freeShippingThreshold;
  return subtotal >= threshold ? 0 : zone.fee;
}
