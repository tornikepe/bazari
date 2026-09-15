import "server-only";

import {
  basic,
  call,
  form,
  majorNumber,
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
 * Bank of Georgia — the Payments (iPay) API.
 *
 * A token from the client id and secret, an order created with the amount,
 * a basket and two URLs, the shopper sent to the bank's page, and the bank
 * calling back with the order's status. The callback is signed by the bank
 * with a key of its own, but nothing here depends on holding that key: the
 * order is fetched back from the bank by its id — the receipt endpoint —
 * and the state recorded is the state the bank reports over our own
 * authenticated call. The shopper's return fetches the same, so a late
 * callback is not a late payment.
 */

const OAUTH =
  "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token";
const BASE = "https://api.bog.ge/payments/v1";

async function token(
  config: GatewayConfig,
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const response = await call<{ access_token?: string }>(OAUTH, {
    method: "POST",
    headers: {
      authorization: basic(config.clientId, config.clientSecret),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form({ grant_type: "client_credentials" }),
  });
  if (!response.ok || !response.body?.access_token) {
    return {
      ok: false,
      reason: reasonFrom(response, "BOG would not issue a token"),
    };
  }
  return { ok: true, token: response.body.access_token };
}

/** What the bank reports for one order, in the callback and the receipt alike. */
type BogOrder = {
  order_id?: string;
  external_order_id?: string;
  order_status?: { key?: string; value?: string };
  purchase_units?: {
    currency_code?: string;
    request_amount?: string | number;
    transfer_amount?: string | number;
    refund_amount?: string | number;
  };
};

function stateOf(key: string | undefined): PaymentState | null {
  switch ((key ?? "").toLowerCase()) {
    case "completed":
      return "captured";
    case "blocked":
      return "authorized";
    case "rejected":
      return "failed";
    case "refunded":
    case "refunded_partially":
      return "refunded";
    case "created":
    case "processing":
      return "pending";
    default:
      return null;
  }
}

async function fetchOrder(
  orderId: string,
  config: GatewayConfig,
): Promise<{ ok: true; order: BogOrder } | { ok: false; reason: string }> {
  const auth = await token(config);
  if (!auth.ok) return auth;
  const response = await call<BogOrder>(
    `${BASE}/receipt/${encodeURIComponent(orderId)}`,
    {
      headers: {
        authorization: `Bearer ${auth.token}`,
        accept: "application/json",
      },
    },
  );
  if (!response.ok || !response.body) {
    return {
      ok: false,
      reason: reasonFrom(response, "BOG would not report the order"),
    };
  }
  return { ok: true, order: response.body };
}

function eventFrom(
  order: BogOrder,
  fallbackPaymentId?: string,
): WebhookResult | null {
  const state = stateOf(order.order_status?.key);
  if (!state || state === "pending" || !order.order_id) return null;
  const units = order.purchase_units;
  const amount = toMinorUnits(
    state === "captured"
      ? (units?.transfer_amount ?? units?.request_amount)
      : units?.request_amount,
  );
  if (amount === null) return null;
  return {
    ok: true,
    paymentId: order.external_order_id || fallbackPaymentId,
    providerRef: order.order_id,
    externalId: `${order.order_id}:${state}`,
    state,
    amount,
    currency: units?.currency_code ?? "GEL",
    ...(state === "failed"
      ? {
          failReason: `BOG: ${order.order_status?.value ?? order.order_status?.key}`,
        }
      : {}),
  };
}

export const bogAdapter: Adapter = {
  id: "bog",
  name: "Bank of Georgia",
  fields: [
    {
      key: "clientId",
      label: { ka: "Client ID", en: "Client ID" },
      hint: {
        ka: "ბიზნეს-ინტერნეტბანკი → iPay → API-ს პარამეტრები, ან ბანკის წერილიდან ხელშეკრულების შემდეგ.",
        en: "Business internet bank → iPay → API settings, or the bank's letter once the contract is signed.",
      },
    },
    {
      key: "clientSecret",
      label: { ka: "Client Secret", en: "Client Secret" },
      secret: true,
    },
  ],

  isConfigured: (config) => Boolean(config.clientId && config.clientSecret),

  async start(input: StartInput, config): Promise<StartResult> {
    const auth = await token(config);
    if (!auth.ok) return { kind: "error", reason: auth.reason };

    const response = await call<{
      id?: string;
      _links?: { redirect?: { href?: string } };
    }>(`${BASE}/ecommerce/orders`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${auth.token}`,
        "content-type": "application/json",
        accept: "application/json",
        "accept-language": input.locale,
      },
      body: JSON.stringify({
        callback_url: input.webhookUrl,
        external_order_id: input.paymentId,
        purchase_units: {
          currency: input.currency,
          total_amount: majorNumber(input.amount),
          basket: [
            {
              product_id: input.orderNumber,
              description: `${input.shopName} · ${input.orderNumber}`,
              quantity: 1,
              unit_price: majorNumber(input.amount),
            },
          ],
        },
        redirect_urls: { fail: input.returnUrl, success: input.returnUrl },
      }),
    });

    const redirect = response.body?._links?.redirect?.href;
    if (!response.ok || !response.body?.id || !redirect) {
      return {
        kind: "error",
        reason: reasonFrom(response, "BOG would not open the order"),
      };
    }
    return { kind: "redirect", url: redirect, providerRef: response.body.id };
  },

  async parseWebhook(_request, rawBody, config): Promise<WebhookResult> {
    let orderId = "";
    try {
      const body = JSON.parse(rawBody) as {
        body?: BogOrder;
        order_id?: string;
      };
      orderId = String(body.body?.order_id ?? body.order_id ?? "");
    } catch {
      return { ok: false, reason: "not JSON" };
    }
    if (!orderId) return { ok: false, reason: "no order id" };

    // The bank's own word over ours: the receipt, fetched, not the body posted.
    const fetched = await fetchOrder(orderId, config);
    if (!fetched.ok) return { ok: false, reason: fetched.reason };
    const event = eventFrom(fetched.order);
    return (
      event ?? {
        ok: false,
        reason: `BOG reports ${fetched.order.order_status?.key ?? "no status"} yet`,
      }
    );
  },

  async finalize(payment: PaymentRow, _request, config) {
    if (!payment.providerRef) return null;
    const fetched = await fetchOrder(payment.providerRef, config);
    if (!fetched.ok) return null;
    return eventFrom(fetched.order, payment.id);
  },

  async refund(providerRef, amount, config) {
    const auth = await token(config);
    if (!auth.ok) return { ok: false, reason: auth.reason };
    const response = await call(
      `${BASE}/payment/refund/${encodeURIComponent(providerRef)}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth.token}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form({ amount: majorNumber(amount).toFixed(2) }),
      },
    );
    if (!response.ok)
      return {
        ok: false,
        reason: reasonFrom(response, "BOG refused the refund"),
      };
    return { ok: true, refunded: amount };
  },
};
