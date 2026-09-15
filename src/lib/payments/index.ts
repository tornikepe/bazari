import "server-only";

import { manualAdapter } from "@/lib/payments/manual";
import { sandboxAdapter, sandboxEnabled } from "@/lib/payments/sandbox";
import { tbcAdapter } from "@/lib/payments/tbc";
import { bogAdapter } from "@/lib/payments/bog";
import { paypalAdapter } from "@/lib/payments/paypal";
import { cryptoAdapter } from "@/lib/payments/crypto";
import { isGatewayMethod, type PaymentMethod } from "@/lib/payment";
import type { Adapter, Minor, PaymentProvider } from "@/lib/payments/types";

export type * from "@/lib/payments/types";

/**
 * Every integration the app knows about.
 *
 * Adding a gateway is: write the adapter, add its id to the `PaymentProvider`
 * and `PaymentMethod` enums in the schema, register it here and in
 * `GATEWAY_IDS`, and give it a label in the dictionary. The actions, the
 * dashboard's page, the checkout and the webhook route are written against
 * `Adapter` and need no change.
 */
const ADAPTERS: Record<PaymentProvider, Adapter> = {
  manual: manualAdapter,
  sandbox: sandboxAdapter,
  tbc: tbcAdapter,
  bog: bogAdapter,
  paypal: paypalAdapter,
  crypto: cryptoAdapter,
};

/**
 * The gateway a plain "card" order is sent to: the sandbox, when it is on.
 * `null` means a card order is recorded the way cash is — a payment row
 * that waits for a human — which is what every deployment without it gets.
 * The real gateways are not "card": each is a payment method of its own,
 * chosen by name at the checkout.
 */
export function cardGateway(): PaymentProvider | null {
  return sandboxEnabled() ? "sandbox" : null;
}

/** The gateway an order's method is paid through, or `null` for cash and transfer. */
export function gatewayFor(method: PaymentMethod): PaymentProvider | null {
  if (isGatewayMethod(method)) return method;
  return method === "card" ? cardGateway() : null;
}

export function getAdapter(provider: PaymentProvider): Adapter {
  return ADAPTERS[provider];
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
