import type { PaymentProvider, PaymentState } from "@/generated/prisma/enums";

export type { PaymentProvider, PaymentState };

/** Money in tetri. Never a float — see the note on `Payment.amount`. */
export type Minor = number;

/**
 * What the dashboard stored for a gateway: its credentials and settings, as
 * strings keyed by the adapter's field names, secrets already opened.
 */
export type GatewayConfig = Record<string, string>;

/** One thing the dashboard asks for on a gateway's form. */
export type GatewayField = {
  key: string;
  label: { ka: string; en: string };
  hint?: { ka: string; en: string };
  placeholder?: string;
  /** Sealed before it is stored, shown as a password, blank means "keep". */
  secret?: boolean;
  /** Not required for the gateway to count as configured. */
  optional?: boolean;
};

export type StartInput = {
  /** Our payment row id; send it to the gateway so callbacks can be matched. */
  paymentId: string;
  orderNumber: string;
  amount: Minor;
  currency: string;
  /** Where the gateway should send the shopper back to. */
  returnUrl: string;
  /** Where it should call us, server to server. */
  webhookUrl: string;
  locale: "ka" | "en";
  /** The dashboard's switch: the gateway's test environment, or the real one. */
  testMode: boolean;
  /** The shop's name, for the gateway's own page. */
  shopName: string;
};

export type StartResult =
  | {
      /** The shopper must be sent to the gateway. */
      kind: "redirect";
      url: string;
      providerRef: string;
      /**
       * What the gateway was asked for, when that is not the order's own
       * currency: the figure a callback must then match.
       */
      charged?: { currency: string; amount: Minor };
    }
  | {
      /** Nothing to collect online — cash on delivery, bank transfer. */
      kind: "offline";
      providerRef: string;
    }
  | { kind: "error"; reason: string };

/**
 * A verified gateway callback, normalised.
 *
 * `externalId` must be stable for a given event: gateways retry, and the
 * unique index on `(paymentId, externalId)` is what stops a retry capturing an
 * order a second time.
 */
export type WebhookResult =
  | {
      ok: true;
      /**
       * Our payment row. A gateway that does not carry our id in its callback
       * may leave this out and give `providerRef`; the service looks the row
       * up by that instead.
       */
      paymentId?: string;
      externalId: string;
      state: PaymentState;
      /** What the gateway says it charged, checked against our own figure. */
      amount: Minor;
      /** The currency of `amount`; the order's own when omitted. */
      currency?: string;
      providerRef?: string;
      failReason?: string;
    }
  | { ok: false; reason: string };

/** The row a return or a callback is about, as `finalize` sees it. */
export type PaymentRow = {
  id: string;
  providerRef: string | null;
  amount: Minor;
  currency: string;
  chargedAmount: number | null;
  chargedCurrency: string | null;
};

export type RefundResult =
  { ok: true; refunded: Minor } | { ok: false; reason: string };

/**
 * What an integration has to provide.
 *
 * Everything provider-independent — creating the row, idempotency, flipping
 * the order, the stock ledger — lives outside this interface, so adding a
 * gateway means implementing these three methods and nothing else.
 */
export type Adapter = {
  readonly id: PaymentProvider;
  /** How the dashboard and the checkout name it. */
  readonly name: string;
  /** What the dashboard asks for. Empty for the gateways configured by env. */
  readonly fields: readonly GatewayField[];

  /** True when the config is complete; false hides it at checkout. */
  isConfigured(config: GatewayConfig): boolean;

  /** Opens an attempt. Must not trust any amount supplied by the browser. */
  start(input: StartInput, config: GatewayConfig): Promise<StartResult>;

  /**
   * Verifies a raw callback — signature first, then shape. Returning
   * `ok: false` must mean "do not trust this", never "unknown status".
   */
  parseWebhook(
    request: Request,
    rawBody: string,
    config: GatewayConfig,
  ): Promise<WebhookResult>;

  /**
   * What to do when the shopper comes back from the gateway, for gateways
   * whose return is part of the protocol (PayPal captures on return) or
   * whose callback may not have arrived yet (a status is fetched): the
   * event to apply, or `null` when there is nothing final to say yet.
   */
  finalize?(
    payment: PaymentRow,
    request: Request,
    config: GatewayConfig,
  ): Promise<WebhookResult | null>;

  /** Sends money back. `amount` omitted means the full remaining balance. */
  refund(
    providerRef: string,
    amount: Minor,
    config: GatewayConfig,
  ): Promise<RefundResult>;
};
