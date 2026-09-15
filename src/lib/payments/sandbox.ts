import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type {
  Adapter,
  StartInput,
  StartResult,
  WebhookResult,
} from "@/lib/payments/types";

/**
 * A gateway that takes no money.
 *
 * Everything a real one does, minus the bank: `start` sends the shopper to a
 * hosted page — a page of this app at `/pay/sandbox` with "pay" and "decline"
 * on it — and that page calls the webhook back, server to server, with a
 * signed body, exactly the way a real gateway does. The service then does
 * what it does for any gateway: records the event once, captures, moves the
 * order to paid. `refund` succeeds at once, because there is nothing to send
 * back.
 *
 * It exists so the card path is a path and not a label: before this, "card"
 * at the checkout recorded a cash-on-delivery order under a different name,
 * and the redirect, the callback and the amount check had never once run.
 * A real adapter — a Georgian bank's — is written against the same
 * interface and swapped in by configuration.
 *
 * Off unless `PAYMENT_SANDBOX=1`. Never on by accident: a deployment that
 * enables it has card orders marked paid without money, and says so on the
 * hosted page in both languages.
 */

export function sandboxEnabled(): boolean {
  return process.env.PAYMENT_SANDBOX === "1";
}

/** Keyed on the session secret, so nothing else has to be configured. */
function key(): string {
  return createHmac("sha256", process.env.AUTH_SECRET ?? "")
    .update("payments:sandbox")
    .digest("hex");
}

/** Signs the hosted page's link and the webhook's body the same way. */
export function sandboxSign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("hex");
}

function sameSignature(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** What the hosted page posts to the webhook. */
export type SandboxEvent = {
  event_id: string;
  payment_id: string;
  status: "captured" | "failed";
  amount: number;
  currency: string;
  ref: string;
};

export const sandboxAdapter: Adapter = {
  id: "sandbox",
  name: "Sandbox",
  fields: [],

  isConfigured: sandboxEnabled,

  async start(input: StartInput): Promise<StartResult> {
    const providerRef = `sbx_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    // The page needs to know which payment it is deciding about, and the
    // link is signed so a shopper cannot edit the id to somebody else's.
    const params = new URLSearchParams({
      payment: input.paymentId,
      ref: providerRef,
      amount: String(input.amount),
      currency: input.currency,
      order: input.orderNumber,
      return: input.returnUrl,
      webhook: input.webhookUrl,
      locale: input.locale,
    });
    params.set("sig", sandboxSign(params.toString()));
    const origin = new URL(input.returnUrl).origin;
    return {
      kind: "redirect",
      url: `${origin}/pay/sandbox?${params.toString()}`,
      providerRef,
    };
  },

  async parseWebhook(
    request: Request,
    rawBody: string,
  ): Promise<WebhookResult> {
    const given = request.headers.get("x-sandbox-signature") ?? "";
    if (!given || !sameSignature(given, sandboxSign(rawBody))) {
      return { ok: false, reason: "bad signature" };
    }

    let event: SandboxEvent;
    try {
      event = JSON.parse(rawBody) as SandboxEvent;
    } catch {
      return { ok: false, reason: "not JSON" };
    }
    if (
      typeof event?.event_id !== "string" ||
      typeof event.payment_id !== "string" ||
      (event.status !== "captured" && event.status !== "failed") ||
      !Number.isInteger(event.amount)
    ) {
      return { ok: false, reason: "malformed event" };
    }

    return {
      ok: true,
      paymentId: event.payment_id,
      externalId: event.event_id,
      state: event.status,
      amount: event.amount,
      providerRef: event.ref,
      ...(event.status === "failed"
        ? { failReason: "declined on the sandbox page" }
        : {}),
    };
  },

  async refund(_providerRef: string, amount) {
    return { ok: true, refunded: amount };
  },
};

/** Checks a hosted-page link the way `start` signed it. */
export function sandboxLinkValid(params: URLSearchParams): boolean {
  const sig = params.get("sig") ?? "";
  const rest = new URLSearchParams(params);
  rest.delete("sig");
  return Boolean(sig) && sameSignature(sig, sandboxSign(rest.toString()));
}
