import "server-only";

import { randomUUID } from "node:crypto";
import type { Adapter, StartInput, StartResult } from "@/lib/payments/types";

/**
 * Cash on delivery and bank transfer.
 *
 * No gateway is involved: the attempt is recorded so every order has a payment
 * row to reconcile against, and it stays `pending` until a human marks the
 * money received from the dashboard. That keeps one code path for "is this
 * order paid?" regardless of how the money arrived.
 */
export const manualAdapter: Adapter = {
  id: "manual",

  isConfigured: () => true,

  async start(input: StartInput): Promise<StartResult> {
    return { kind: "offline", providerRef: `manual_${input.paymentId}_${randomUUID().slice(0, 8)}` };
  },

  async parseWebhook() {
    // Nothing calls us back for cash — capture happens from the dashboard.
    return { ok: false as const, reason: "the manual provider has no webhook" };
  },

  async refund() {
    // The money never went through a gateway, so there is nothing to reverse
    // automatically; the refund is recorded and handed back in person.
    return { ok: false as const, reason: "refund a manual payment by hand" };
  },
};
