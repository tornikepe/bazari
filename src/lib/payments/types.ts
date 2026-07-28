import type { PaymentProvider, PaymentState } from "@/generated/prisma/enums";

export type { PaymentProvider, PaymentState };

/** Money in tetri. Never a float — see the note on `Payment.amount`. */
export type Minor = number;

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
};

export type StartResult =
  | {
      /** The shopper must be sent to the gateway. */
      kind: "redirect";
      url: string;
      providerRef: string;
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
      paymentId: string;
      externalId: string;
      state: PaymentState;
      /** What the gateway says it charged, checked against our own figure. */
      amount: Minor;
      providerRef?: string;
      failReason?: string;
    }
  | { ok: false; reason: string };

export type RefundResult = { ok: true; refunded: Minor } | { ok: false; reason: string };

/**
 * What an integration has to provide.
 *
 * Everything provider-independent — creating the row, idempotency, flipping
 * the order, the stock ledger — lives outside this interface, so adding a
 * gateway means implementing these three methods and nothing else.
 */
export type Adapter = {
  readonly id: PaymentProvider;

  /** True when the gateway is configured; false hides it at checkout. */
  isConfigured(): boolean;

  /** Opens an attempt. Must not trust any amount supplied by the browser. */
  start(input: StartInput): Promise<StartResult>;

  /**
   * Verifies a raw callback — signature first, then shape. Returning
   * `ok: false` must mean "do not trust this", never "unknown status".
   */
  parseWebhook(request: Request, rawBody: string): Promise<WebhookResult>;

  /** Sends money back. `amount` omitted means the full remaining balance. */
  refund(providerRef: string, amount: Minor): Promise<RefundResult>;
};
