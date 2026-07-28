import "server-only";

import { manualAdapter } from "@/lib/payments/manual";
import type { Adapter, Minor, PaymentProvider } from "@/lib/payments/types";

export type * from "@/lib/payments/types";

/**
 * Every integration the app knows about.
 *
 * Adding a gateway is: write the adapter, add its id to the `PaymentProvider`
 * enum in the schema, and register it here. Nothing else in the app needs to
 * change — the actions and the webhook route are written against `Adapter`.
 */
const ADAPTERS: Record<PaymentProvider, Adapter> = {
  manual: manualAdapter,
};

export function getAdapter(provider: PaymentProvider): Adapter {
  return ADAPTERS[provider];
}

/** Only the gateways that actually have credentials configured. */
export function availableProviders(): PaymentProvider[] {
  return (Object.keys(ADAPTERS) as PaymentProvider[]).filter((id) =>
    ADAPTERS[id].isConfigured(),
  );
}

/**
 * Converts a display price to tetri.
 *
 * The rest of the schema stores prices as Float, which cannot represent most
 * decimals exactly. Rounding here — once, at the boundary — is what stops a
 * charge from drifting a tetri away from the total the shopper was shown.
 */
export function toMinor(amount: number): Minor {
  return Math.round(amount * 100);
}

export function fromMinor(amount: Minor): number {
  return amount / 100;
}

/** How long an unfinished attempt stays open before the sweeper expires it. */
export const PAYMENT_WINDOW_MINUTES = 30;
