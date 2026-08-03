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
 * Order totals are already whole tetri, so this is the identity — kept as a
 * named boundary so a gateway adapter that needs a different unit has one
 * obvious place to convert, and so call sites still read as a conversion.
 */
export function toMinor(tetri: number): Minor {
  return Math.round(tetri);
}

/** Tetri to lari, for a human-readable note. Never for an amount charged. */
export function fromMinor(tetri: Minor): number {
  return tetri / 100;
}

/** How long an unfinished attempt stays open before the sweeper expires it. */
export const PAYMENT_WINDOW_MINUTES = 30;
