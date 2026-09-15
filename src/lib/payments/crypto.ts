import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  call,
  convert,
  majorString,
  reasonFrom,
  toMinorUnits,
} from "@/lib/payments/http";
import type {
  Adapter,
  GatewayConfig,
  PaymentRow,
  PaymentState,
  StartInput,
  StartResult,
  WebhookResult,
} from "@/lib/payments/types";

/**
 * Cryptocurrency — through Coinbase Commerce.
 *
 * A "charge" is created for the order's amount in the currency the account
 * prices in (no lari here either, so the dashboard's rate applies), the
 * shopper is sent to the hosted page and pays in whichever coin they
 * choose, and Coinbase calls back when the chain has confirmed it. The
 * callback is signed with a shared secret — an HMAC over the raw body —
 * which is checked before anything in it is read. The shopper's return
 * fetches the charge, so a confirmation that arrives while they are away
 * still shows on the order page.
 *
 * Refunds are not a thing a chain does on request; the adapter says so and
 * the dashboard's refund is recorded and settled by hand.
 */

const BASE = "https://api.commerce.coinbase.com";

function headers(config: GatewayConfig) {
  return {
    "x-cc-api-key": config.apiKey,
    "x-cc-version": "2018-03-22",
    "content-type": "application/json",
    accept: "application/json",
  };
}

function currencyOf(config: GatewayConfig): string {
  return (config.currency || "USD").trim().toUpperCase().slice(0, 3);
}

type Charge = {
  id?: string;
  code?: string;
  hosted_url?: string;
  metadata?: { payment_id?: string };
  pricing?: { local?: { amount?: string; currency?: string } };
  timeline?: { status?: string; time?: string }[];
};

/** The last thing that happened to a charge, in our states. */
function stateOf(charge: Charge): PaymentState | null {
  const last = charge.timeline?.at(-1)?.status ?? "";
  switch (last.toUpperCase()) {
    case "COMPLETED":
    case "CONFIRMED":
    case "RESOLVED":
      return "captured";
    case "EXPIRED":
    case "CANCELED":
    case "CANCELLED":
      return "failed";
    case "UNRESOLVED":
      // Paid, but not the right amount — a person has to look at it.
      return "failed";
    default:
      return null;
  }
}

function eventFrom(
  charge: Charge,
  externalId: string,
  fallbackPaymentId?: string,
): WebhookResult | null {
  const state = stateOf(charge);
  const amount = toMinorUnits(charge.pricing?.local?.amount);
  if (!state || !charge.code || amount === null) return null;
  return {
    ok: true,
    paymentId: charge.metadata?.payment_id || fallbackPaymentId,
    providerRef: charge.code,
    externalId,
    state,
    amount,
    currency: charge.pricing?.local?.currency,
    ...(state === "failed"
      ? { failReason: `Coinbase Commerce: ${charge.timeline?.at(-1)?.status}` }
      : {}),
  };
}

export const cryptoAdapter: Adapter = {
  id: "crypto",
  name: "Crypto (Coinbase Commerce)",
  fields: [
    {
      key: "apiKey",
      label: { ka: "API Key", en: "API key" },
      hint: {
        ka: "commerce.coinbase.com → Settings → API keys → Create an API key.",
        en: "commerce.coinbase.com → Settings → API keys → Create an API key.",
      },
      secret: true,
    },
    {
      key: "webhookSecret",
      label: { ka: "Webhook shared secret", en: "Webhook shared secret" },
      hint: {
        ka: "Settings → Webhook subscriptions → Add endpoint → მისამართი ქვემოთ → Show shared secret.",
        en: "Settings → Webhook subscriptions → Add endpoint → the URL below → Show shared secret.",
      },
      secret: true,
    },
    {
      key: "currency",
      label: { ka: "ვალუტა", en: "Currency" },
      hint: {
        ka: "რომელშიც ფასი უნდა დაითვალოს: USD ან EUR. მყიდველი ნებისმიერი კრიპტოვალუტით იხდის.",
        en: "The currency the price is quoted in: USD or EUR. The shopper pays in any coin.",
      },
      placeholder: "USD",
    },
    {
      key: "rate",
      label: { ka: "კურსი — ლარი ერთ ერთეულში", en: "Rate — lari per unit" },
      hint: {
        ka: "მაგ. 2.70 ნიშნავს 1 USD = 2.70 ₾.",
        en: "E.g. 2.70 means 1 USD = 2.70 ₾.",
      },
      placeholder: "2.70",
    },
  ],

  isConfigured: (config) =>
    Boolean(
      config.apiKey &&
      config.webhookSecret &&
      currencyOf(config) &&
      convert(100, config.rate),
    ),

  async start(input: StartInput, config): Promise<StartResult> {
    const currency = currencyOf(config);
    const charged = convert(input.amount, config.rate);
    if (charged === null || charged < 1)
      return { kind: "error", reason: "the crypto rate is not set" };

    const response = await call<{ data?: Charge }>(`${BASE}/charges`, {
      method: "POST",
      headers: headers(config),
      body: JSON.stringify({
        name: input.shopName,
        description: input.orderNumber,
        pricing_type: "fixed_price",
        local_price: { amount: majorString(charged), currency },
        metadata: { payment_id: input.paymentId, order: input.orderNumber },
        redirect_url: input.returnUrl,
        cancel_url: input.returnUrl,
      }),
    });

    const charge = response.body?.data;
    if (!response.ok || !charge?.code || !charge.hosted_url) {
      return {
        kind: "error",
        reason: reasonFrom(
          response,
          "Coinbase Commerce would not open the charge",
        ),
      };
    }
    return {
      kind: "redirect",
      url: charge.hosted_url,
      providerRef: charge.code,
      charged: { currency, amount: charged },
    };
  },

  async parseWebhook(request, rawBody, config): Promise<WebhookResult> {
    const given = request.headers.get("x-cc-webhook-signature") ?? "";
    const expected = createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    if (!given || a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "bad signature" };
    }

    let body: { event?: { id?: string; type?: string; data?: Charge } };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "not JSON" };
    }
    const event = body.event;
    if (!event?.id || !event.data)
      return { ok: false, reason: "malformed event" };

    // The event type says what happened; the charge's own timeline says
    // the same and is what `finalize` reads, so both go through one map.
    const charge: Charge = {
      ...event.data,
      timeline:
        event.type === "charge:confirmed"
          ? [{ status: "CONFIRMED" }]
          : event.type === "charge:failed"
            ? [{ status: "EXPIRED" }]
            : event.type === "charge:resolved"
              ? [{ status: "RESOLVED" }]
              : (event.data.timeline ?? []),
    };
    const result = eventFrom(charge, event.id);
    return result ?? { ok: false, reason: `not final: ${event.type}` };
  },

  async finalize(payment: PaymentRow, _request, config) {
    if (!payment.providerRef) return null;
    const response = await call<{ data?: Charge }>(
      `${BASE}/charges/${encodeURIComponent(payment.providerRef)}`,
      { headers: headers(config) },
    );
    const charge = response.body?.data;
    if (!response.ok || !charge) return null;
    const state = stateOf(charge);
    return state
      ? eventFrom(charge, `${charge.code}:${state}`, payment.id)
      : null;
  },

  async refund() {
    return {
      ok: false,
      reason:
        "a crypto payment is refunded by hand, to the address the shopper gives",
    };
  },
};
