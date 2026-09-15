import "server-only";

import {
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
 * TBC Bank — the TPAY e-commerce API.
 *
 * The shape of it: a short-lived access token from the client id and
 * secret, a payment created with the amount and two URLs, the shopper sent
 * to the bank's approval page, and the bank calling `callbackUrl` when it
 * is over. The callback carries only the bank's payment id and no
 * signature, so nothing in it is believed: the payment is fetched from the
 * bank by that id, over our own authenticated call, and what the bank
 * says then is what is recorded. The shopper's return does the same fetch,
 * so an order is marked paid even when the callback is late.
 *
 * Test and live share one host; which one an order hits is decided by the
 * credentials the dashboard holds, which is how the bank arranges it.
 */

const BASE = "https://api.tbcbank.ge/v1/tpay";

async function token(
  config: GatewayConfig,
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const response = await call<{ access_token?: string }>(
    `${BASE}/access-token`,
    {
      method: "POST",
      headers: {
        apikey: config.apiKey,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form({
        client_Id: config.clientId,
        client_secret: config.clientSecret,
      }),
    },
  );
  if (!response.ok || !response.body?.access_token) {
    return {
      ok: false,
      reason: reasonFrom(response, "TBC would not issue a token"),
    };
  }
  return { ok: true, token: response.body.access_token };
}

function headers(config: GatewayConfig, bearer: string) {
  return {
    apikey: config.apiKey,
    authorization: `Bearer ${bearer}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

/** What the bank reports for one payment. */
type TbcPayment = {
  payId?: string;
  status?: string;
  currency?: string;
  amount?: number | string;
  confirmedAmount?: number | string;
  merchantPaymentId?: string;
  transactionId?: string;
};

/** The bank's words for a payment's state, in ours. */
function stateOf(status: string | undefined): PaymentState | null {
  switch ((status ?? "").toLowerCase()) {
    case "succeeded":
      return "captured";
    case "failed":
    case "expired":
    case "cancelled":
    case "canceled":
      return "failed";
    case "returned":
      return "refunded";
    case "created":
    case "processing":
    case "waitingconfirm":
      return "pending";
    default:
      return null;
  }
}

async function fetchPayment(
  payId: string,
  config: GatewayConfig,
): Promise<{ ok: true; payment: TbcPayment } | { ok: false; reason: string }> {
  const auth = await token(config);
  if (!auth.ok) return auth;
  const response = await call<TbcPayment>(
    `${BASE}/payments/${encodeURIComponent(payId)}`,
    {
      headers: headers(config, auth.token),
    },
  );
  if (!response.ok || !response.body) {
    return {
      ok: false,
      reason: reasonFrom(response, "TBC would not report the payment"),
    };
  }
  return { ok: true, payment: response.body };
}

/** One payment as the bank reports it, as an event to apply. */
function eventFrom(
  payment: TbcPayment,
  fallbackPaymentId?: string,
): WebhookResult | null {
  const state = stateOf(payment.status);
  if (!state || state === "pending") return null;
  const amount = toMinorUnits(payment.confirmedAmount ?? payment.amount);
  if (amount === null || !payment.payId) return null;
  return {
    ok: true,
    paymentId: payment.merchantPaymentId || fallbackPaymentId,
    providerRef: payment.payId,
    externalId: `${payment.payId}:${state}`,
    state,
    amount,
    currency: payment.currency ?? "GEL",
    ...(state === "failed" ? { failReason: `TBC: ${payment.status}` } : {}),
  };
}

export const tbcAdapter: Adapter = {
  id: "tbc",
  name: "TBC Bank",
  fields: [
    {
      key: "apiKey",
      label: { ka: "API გასაღები (apikey)", en: "API key (apikey)" },
      hint: {
        ka: "TBC-ს დეველოპერთა პორტალიდან: developers.tbcbank.ge → შენი აპლიკაცია → API Key.",
        en: "From TBC's developer portal: developers.tbcbank.ge → your application → API Key.",
      },
      secret: true,
    },
    {
      key: "clientId",
      label: { ka: "Client ID", en: "Client ID" },
      hint: {
        ka: "TPAY-ის მერჩანტის მონაცემები, რომელსაც ბანკი ხელშეკრულების შემდეგ გაძლევს.",
        en: "The TPAY merchant credentials the bank issues once the contract is signed.",
      },
    },
    {
      key: "clientSecret",
      label: { ka: "Client Secret", en: "Client Secret" },
      secret: true,
    },
  ],

  isConfigured: (config) =>
    Boolean(config.apiKey && config.clientId && config.clientSecret),

  async start(input: StartInput, config): Promise<StartResult> {
    const auth = await token(config);
    if (!auth.ok) return { kind: "error", reason: auth.reason };

    const response = await call<{
      payId?: string;
      status?: string;
      links?: { uri?: string; rel?: string; method?: string }[];
    }>(`${BASE}/payments`, {
      method: "POST",
      headers: headers(config, auth.token),
      body: JSON.stringify({
        amount: { currency: input.currency, total: majorNumber(input.amount) },
        returnurl: input.returnUrl,
        callbackUrl: input.webhookUrl,
        merchantPaymentId: input.paymentId,
        description: `${input.shopName} · ${input.orderNumber}`,
        language: input.locale === "ka" ? "KA" : "EN",
        preAuth: false,
      }),
    });

    const approval = response.body?.links?.find(
      (link) => link.rel === "approval_url",
    )?.uri;
    if (!response.ok || !response.body?.payId || !approval) {
      return {
        kind: "error",
        reason: reasonFrom(response, "TBC would not open the payment"),
      };
    }
    return {
      kind: "redirect",
      url: approval,
      providerRef: response.body.payId,
    };
  },

  async parseWebhook(_request, rawBody, config): Promise<WebhookResult> {
    // The callback names the payment and nothing else is trusted from it.
    let payId = "";
    try {
      const body = JSON.parse(rawBody) as {
        PaymentId?: string;
        paymentId?: string;
        payId?: string;
      };
      payId = String(body.PaymentId ?? body.paymentId ?? body.payId ?? "");
    } catch {
      return { ok: false, reason: "not JSON" };
    }
    if (!payId) return { ok: false, reason: "no payment id" };

    const fetched = await fetchPayment(payId, config);
    if (!fetched.ok) return { ok: false, reason: fetched.reason };
    const event = eventFrom(fetched.payment);
    return (
      event ?? {
        ok: false,
        reason: `TBC reports ${fetched.payment.status ?? "no status"} yet`,
      }
    );
  },

  async finalize(payment: PaymentRow, _request, config) {
    if (!payment.providerRef) return null;
    const fetched = await fetchPayment(payment.providerRef, config);
    if (!fetched.ok) return null;
    return eventFrom(fetched.payment, payment.id);
  },

  async refund(providerRef, amount, config) {
    const auth = await token(config);
    if (!auth.ok) return { ok: false, reason: auth.reason };
    const response = await call(
      `${BASE}/payments/${encodeURIComponent(providerRef)}/cancel`,
      {
        method: "POST",
        headers: headers(config, auth.token),
        body: JSON.stringify({ amount: majorNumber(amount) }),
      },
    );
    if (!response.ok)
      return {
        ok: false,
        reason: reasonFrom(response, "TBC refused the refund"),
      };
    return { ok: true, refunded: amount };
  },
};
