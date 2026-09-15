import "server-only";

import {
  basic,
  call,
  convert,
  form,
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
 * PayPal — Orders v2.
 *
 * PayPal takes no lari, so the dashboard names the currency the account
 * settles in and the rate — lari per unit — and the order is opened for
 * the converted figure; that figure is what a capture has to match. The
 * money moves in two steps: an order is created and the shopper approves it
 * on PayPal's page, then it is *captured* when they come back — by
 * `finalize`, on our return route — and only a capture is a payment. A
 * webhook is optional: with a webhook id configured, `PAYMENT.CAPTURE.*`
 * events are verified against PayPal and applied too, which covers a
 * shopper who closes the tab between approving and returning.
 *
 * Test mode is the sandbox host and sandbox credentials.
 */

function base(testMode: boolean): string {
  return testMode
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

/** The dashboard's currency, upper-cased, USD when it left the field blank. */
function currencyOf(config: GatewayConfig): string {
  return (config.currency || "USD").trim().toUpperCase().slice(0, 3);
}

async function token(
  config: GatewayConfig,
  testMode: boolean,
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const response = await call<{ access_token?: string }>(
    `${base(testMode)}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        authorization: basic(config.clientId, config.clientSecret),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form({ grant_type: "client_credentials" }),
    },
  );
  if (!response.ok || !response.body?.access_token) {
    return {
      ok: false,
      reason: reasonFrom(response, "PayPal would not issue a token"),
    };
  }
  return { ok: true, token: response.body.access_token };
}

type Capture = {
  id?: string;
  status?: string;
  amount?: { currency_code?: string; value?: string };
  custom_id?: string;
};

type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    payments?: { captures?: Capture[] };
  }[];
  links?: { rel?: string; href?: string }[];
};

/** A capture, as PayPal reports it, as an event to apply. */
function eventFromCapture(
  capture: Capture,
  paymentId: string | undefined,
): WebhookResult | null {
  const amount = toMinorUnits(capture.amount?.value);
  if (!capture.id || amount === null) return null;
  const state: PaymentState | null =
    capture.status === "COMPLETED"
      ? "captured"
      : capture.status === "PENDING"
        ? "pending"
        : capture.status === "DECLINED" || capture.status === "FAILED"
          ? "failed"
          : capture.status === "REFUNDED" ||
              capture.status === "PARTIALLY_REFUNDED"
            ? "refunded"
            : null;
  if (!state || state === "pending") return null;
  return {
    ok: true,
    paymentId: paymentId || capture.custom_id,
    providerRef: capture.id,
    externalId: `${capture.id}:${state}`,
    state,
    amount,
    currency: capture.amount?.currency_code,
    ...(state === "failed" ? { failReason: `PayPal: ${capture.status}` } : {}),
  };
}

/** The mode a stored config runs in is read back from the row, not guessed. */
function testModeOf(config: GatewayConfig): boolean {
  return config.__testMode === "1";
}

export const paypalAdapter: Adapter = {
  id: "paypal",
  name: "PayPal",
  fields: [
    {
      key: "clientId",
      label: { ka: "Client ID", en: "Client ID" },
      hint: {
        ka: "developer.paypal.com → Apps & Credentials → შენი აპლიკაცია. Sandbox-ის და Live-ის გასაღებები სხვადასხვაა — რომელსაც ჩაწერ, ის რეჟიმი ჩართე.",
        en: "developer.paypal.com → Apps & Credentials → your app. Sandbox and Live keys differ — switch the mode to match the ones you paste.",
      },
    },
    {
      key: "clientSecret",
      label: { ka: "Secret", en: "Secret" },
      secret: true,
    },
    {
      key: "currency",
      label: { ka: "ვალუტა", en: "Currency" },
      hint: {
        ka: "PayPal ლარს არ იღებს. ვალუტა, რომელშიც შენი ანგარიში იღებს თანხას: USD ან EUR.",
        en: "PayPal takes no lari. The currency your account settles in: USD or EUR.",
      },
      placeholder: "USD",
    },
    {
      key: "rate",
      label: { ka: "კურსი — ლარი ერთ ერთეულში", en: "Rate — lari per unit" },
      hint: {
        ka: "მაგ. 2.70 ნიშნავს 1 USD = 2.70 ₾. ლარის ჯამი ამ კურსით გადაიყვანება.",
        en: "E.g. 2.70 means 1 USD = 2.70 ₾. The lari total is converted at this rate.",
      },
      placeholder: "2.70",
    },
    {
      key: "webhookId",
      label: { ka: "Webhook ID (სურვილისამებრ)", en: "Webhook ID (optional)" },
      hint: {
        ka: "Apps & Credentials → აპლიკაცია → Webhooks → Add → მისამართი ქვემოთ, event: Payment capture completed/denied/refunded. მის გარეშეც მუშაობს: გადახდა შენს საიტზე დაბრუნებისას დასტურდება.",
        en: "Apps & Credentials → your app → Webhooks → Add → the URL below, events: payment capture completed/denied/refunded. Works without it: the capture happens when the shopper returns.",
      },
      optional: true,
    },
  ],

  isConfigured: (config) =>
    Boolean(
      config.clientId &&
      config.clientSecret &&
      currencyOf(config) &&
      convert(100, config.rate),
    ),

  async start(input: StartInput, config): Promise<StartResult> {
    const currency = currencyOf(config);
    const charged = convert(input.amount, config.rate);
    if (charged === null || charged < 1)
      return { kind: "error", reason: "the PayPal rate is not set" };

    const auth = await token(config, input.testMode);
    if (!auth.ok) return { kind: "error", reason: auth.reason };

    const response = await call<PayPalOrder>(
      `${base(input.testMode)}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth.token}`,
          "content-type": "application/json",
          // The same request twice — a retried start — makes one order, not two.
          "paypal-request-id": input.paymentId,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: input.paymentId,
              custom_id: input.paymentId,
              description: `${input.shopName} · ${input.orderNumber}`,
              amount: { currency_code: currency, value: majorString(charged) },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: input.shopName,
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                return_url: input.returnUrl,
                cancel_url: input.returnUrl,
                locale: input.locale === "ka" ? "ka-GE" : "en-US",
              },
            },
          },
        }),
      },
    );

    const approve = response.body?.links?.find(
      (link) => link.rel === "payer-action" || link.rel === "approve",
    )?.href;
    if (!response.ok || !response.body?.id || !approve) {
      return {
        kind: "error",
        reason: reasonFrom(response, "PayPal would not open the order"),
      };
    }
    return {
      kind: "redirect",
      url: approve,
      providerRef: response.body.id,
      charged: { currency, amount: charged },
    };
  },

  async parseWebhook(request, rawBody, config): Promise<WebhookResult> {
    if (!config.webhookId)
      return { ok: false, reason: "no webhook id configured" };
    const testMode = testModeOf(config);
    const auth = await token(config, testMode);
    if (!auth.ok) return { ok: false, reason: auth.reason };

    let event: { id?: string; event_type?: string; resource?: Capture };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "not JSON" };
    }

    // PayPal signs with a certificate it hosts; asking PayPal to verify is
    // the documented way and spares this file a certificate cache.
    const verification = await call<{ verification_status?: string }>(
      `${base(testMode)}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          auth_algo: request.headers.get("paypal-auth-algo"),
          cert_url: request.headers.get("paypal-cert-url"),
          transmission_id: request.headers.get("paypal-transmission-id"),
          transmission_sig: request.headers.get("paypal-transmission-sig"),
          transmission_time: request.headers.get("paypal-transmission-time"),
          webhook_id: config.webhookId,
          webhook_event: event,
        }),
      },
    );
    if (
      !verification.ok ||
      verification.body?.verification_status !== "SUCCESS"
    ) {
      return { ok: false, reason: "signature not verified" };
    }

    const type = event.event_type ?? "";
    if (!type.startsWith("PAYMENT.CAPTURE.") || !event.resource) {
      return { ok: false, reason: `not a capture event: ${type}` };
    }
    const result = eventFromCapture(event.resource, event.resource.custom_id);
    return result ?? { ok: false, reason: "capture not final" };
  },

  async finalize(payment: PaymentRow, request, config) {
    if (!payment.providerRef) return null;
    const testMode = testModeOf(config);
    const auth = await token(config, testMode);
    if (!auth.ok) return null;

    // The shopper approved on PayPal's page and came back with `?token=`,
    // which is the order id we already hold; a return without it is a
    // cancel, and there is nothing to capture.
    const token_ = new URL(request.url).searchParams.get("token");
    if (token_ && token_ !== payment.providerRef) return null;

    const capture = await call<PayPalOrder>(
      `${base(testMode)}/v2/checkout/orders/${encodeURIComponent(payment.providerRef)}/capture`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth.token}`,
          "content-type": "application/json",
          "paypal-request-id": `${payment.id}:capture`,
        },
        body: "{}",
      },
    );

    // Already captured — by a webhook, or by a second return — reads the
    // same as a fresh capture once the order is fetched.
    let order = capture.body;
    if (!capture.ok) {
      const issue = (capture.body as { details?: { issue?: string }[] } | null)
        ?.details?.[0]?.issue;
      if (issue !== "ORDER_ALREADY_CAPTURED") return null;
      const fetched = await call<PayPalOrder>(
        `${base(testMode)}/v2/checkout/orders/${encodeURIComponent(payment.providerRef)}`,
        { headers: { authorization: `Bearer ${auth.token}` } },
      );
      if (!fetched.ok) return null;
      order = fetched.body;
    }

    const captured = order?.purchase_units?.[0]?.payments?.captures?.[0];
    return captured ? eventFromCapture(captured, payment.id) : null;
  },

  async refund(providerRef, amount, config) {
    const testMode = testModeOf(config);
    const currency = currencyOf(config);
    const charged = convert(amount, config.rate);
    if (charged === null)
      return { ok: false, reason: "the PayPal rate is not set" };
    const auth = await token(config, testMode);
    if (!auth.ok) return { ok: false, reason: auth.reason };
    const response = await call(
      `${base(testMode)}/v2/payments/captures/${encodeURIComponent(providerRef)}/refund`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${auth.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: { currency_code: currency, value: majorString(charged) },
        }),
      },
    );
    if (!response.ok)
      return {
        ok: false,
        reason: reasonFrom(response, "PayPal refused the refund"),
      };
    return { ok: true, refunded: amount };
  },
};
