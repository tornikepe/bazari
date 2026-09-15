import "server-only";

import { prisma } from "@/lib/prisma";
import { getAdapter, toMinor, PAYMENT_WINDOW_MINUTES } from "@/lib/payments";
import { getGateway, isGatewayId } from "@/lib/payments/gateways";
import { getSettings } from "@/lib/settings";
import type {
  GatewayConfig,
  Minor,
  PaymentProvider,
  PaymentState,
} from "@/lib/payments/types";

/**
 * What an adapter is handed to talk to its gateway: the dashboard's row for
 * the four configured there, nothing for the two that need nothing. `null`
 * when the provider is switched off or not fully filled in, which is the
 * one answer every caller treats the same way — as "not available".
 */
export async function gatewayContext(
  provider: PaymentProvider,
): Promise<{ config: GatewayConfig; testMode: boolean } | null> {
  if (!isGatewayId(provider)) {
    const adapter = getAdapter(provider);
    return adapter.isConfigured({}) ? { config: {}, testMode: false } : null;
  }
  const gateway = await getGateway(provider);
  if (!gateway || !gateway.enabled || !gateway.configured) return null;
  return { config: gateway.config, testMode: gateway.testMode };
}

/**
 * Provider-independent payment logic.
 *
 * Everything here is deliberately outside the adapters: how an attempt is
 * opened, how a callback is applied exactly once, and how an order's status
 * follows from its payments. An adapter only speaks HTTP to its gateway.
 */

/* ------------------------------------------------------------------ */
/* Starting an attempt                                                 */
/* ------------------------------------------------------------------ */

export type StartPaymentResult =
  | { ok: true; kind: "redirect"; url: string }
  | { ok: true; kind: "offline" }
  | { ok: false; reason: string };

/**
 * Opens a payment for an order.
 *
 * The amount is read from the order row, never from the caller — the browser
 * has no say in what gets charged.
 */
export async function startPayment(
  orderNumber: string,
  provider: PaymentProvider,
  origin: string,
  locale: "ka" | "en",
): Promise<StartPaymentResult> {
  const order = await prisma.order.findUnique({
    where: { number: orderNumber },
    select: { id: true, number: true, total: true, paymentStatus: true },
  });

  if (!order) return { ok: false, reason: "no such order" };
  if (order.paymentStatus === "paid")
    return { ok: false, reason: "already paid" };

  const amount = toMinor(order.total);
  const adapter = getAdapter(provider);
  const context = await gatewayContext(provider);
  if (!context) return { ok: false, reason: `${provider} is not configured` };

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider,
      amount,
      expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60_000),
    },
    select: { id: true },
  });

  const settings = await getSettings();
  const started = await adapter.start(
    {
      paymentId: payment.id,
      orderNumber: order.number,
      amount,
      currency: "GEL",
      // Back through our own route, which asks the gateway what happened
      // before showing the order — so the page the shopper lands on already
      // says "paid" when it is, callback or no callback.
      returnUrl: `${origin}/api/payments/${provider}/return?payment=${payment.id}`,
      webhookUrl: `${origin}/api/payments/${provider}/webhook`,
      locale,
      testMode: context.testMode,
      shopName: settings.name,
    },
    context.config,
  );

  if (started.kind === "error") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { state: "failed", failReason: started.reason },
    });
    return { ok: false, reason: started.reason };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerRef: started.providerRef,
      ...(started.kind === "redirect" && started.charged
        ? {
            chargedAmount: started.charged.amount,
            chargedCurrency: started.charged.currency,
          }
        : {}),
    },
  });

  return started.kind === "redirect"
    ? { ok: true, kind: "redirect", url: started.url }
    : { ok: true, kind: "offline" };
}

/* ------------------------------------------------------------------ */
/* Applying a gateway callback                                         */
/* ------------------------------------------------------------------ */

export type ApplyResult =
  | { ok: true; applied: boolean; state: PaymentState }
  | { ok: false; reason: string };

/**
 * Records one gateway event and moves the order if it changes anything.
 *
 * Idempotent by construction: the insert into `PaymentEvent` is guarded by a
 * unique index on `(paymentId, externalId)`, so a webhook the gateway retries
 * — which they all do — collides and does nothing the second time. Everything
 * that follows happens in the same transaction as that insert.
 */
export async function applyPaymentEvent(input: {
  provider: PaymentProvider;
  paymentId?: string;
  externalId: string;
  state: PaymentState;
  amount: Minor;
  currency?: string;
  providerRef?: string;
  failReason?: string;
  payload: string;
}): Promise<ApplyResult> {
  const select = {
    id: true,
    orderId: true,
    amount: true,
    currency: true,
    chargedAmount: true,
    chargedCurrency: true,
    state: true,
  } as const;
  // By our id when the gateway carried it, by the gateway's own reference
  // when it did not — the pair is unique per provider.
  const payment = input.paymentId
    ? await prisma.payment.findUnique({
        where: { id: input.paymentId },
        select,
      })
    : input.providerRef
      ? await prisma.payment.findUnique({
          where: {
            provider_providerRef: {
              provider: input.provider,
              providerRef: input.providerRef,
            },
          },
          select,
        })
      : null;

  if (!payment) return { ok: false, reason: "unknown payment" };

  // A gateway that reports a different figure than we asked for is either
  // misconfigured or being tampered with. Never capture on that. The figure
  // asked for is the converted one when the gateway was asked in another
  // currency, and the order's own otherwise.
  const expected = payment.chargedAmount ?? payment.amount;
  const expectedCurrency = payment.chargedCurrency ?? payment.currency;
  const currencyMatches =
    !input.currency || input.currency.toUpperCase() === expectedCurrency;
  if (
    input.state === "captured" &&
    (input.amount !== expected || !currencyMatches)
  ) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        state: "failed",
        failReason: `amount mismatch: gateway ${input.amount} ${input.currency ?? ""}, expected ${expected} ${expectedCurrency}`,
      },
    });
    return { ok: false, reason: "amount mismatch" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Throws P2002 on a replay — that is the idempotency check.
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          externalId: input.externalId,
          state: input.state,
          payload: input.payload.slice(0, 8000),
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          state: input.state,
          failReason: input.failReason ?? "",
          capturedAt: input.state === "captured" ? new Date() : undefined,
          providerRef: input.providerRef ?? undefined,
        },
      });

      if (input.state === "captured") {
        // Paid, and — for an order still waiting to be looked at — confirmed
        // in the same breath: the money is the confirmation an online order
        // was waiting for, and the shop can start on it.
        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
          select: { status: true },
        });
        const confirm = order?.status === "pending";
        await tx.order.update({
          where: { id: payment.orderId },
          data: {
            paymentStatus: "paid",
            ...(confirm ? { status: "confirmed" } : {}),
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: payment.orderId,
            status: confirm ? "confirmed" : (order?.status ?? "pending"),
            note: "Payment received",
          },
        });
      }
    });

    return { ok: true, applied: true, state: input.state };
  } catch (error) {
    const duplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    // Already processed. The gateway just wants a 200 so it stops retrying.
    if (duplicate) return { ok: true, applied: false, state: payment.state };

    console.error("applyPaymentEvent failed", error);
    return { ok: false, reason: "could not record the event" };
  }
}

/* ------------------------------------------------------------------ */
/* The shopper's return                                                 */
/* ------------------------------------------------------------------ */

/**
 * What to do when the shopper comes back from a gateway: ask the adapter
 * whether there is something final to record — a capture to make, a status
 * to fetch — and record it through the same path a callback takes. Returns
 * the order number to send the shopper on to, or `null` for a payment that
 * is not ours to show.
 */
export async function finalizeReturn(
  provider: PaymentProvider,
  paymentId: string,
  request: Request,
): Promise<string | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      provider: true,
      providerRef: true,
      amount: true,
      currency: true,
      chargedAmount: true,
      chargedCurrency: true,
      state: true,
      order: { select: { number: true } },
    },
  });
  if (!payment || payment.provider !== provider) return null;

  const adapter = getAdapter(provider);
  const context = await gatewayContext(provider);
  if (adapter.finalize && context && payment.state !== "captured") {
    try {
      const event = await adapter.finalize(payment, request, context.config);
      if (event?.ok) {
        await applyPaymentEvent({
          provider,
          paymentId: event.paymentId ?? payment.id,
          externalId: event.externalId,
          state: event.state,
          amount: event.amount,
          currency: event.currency,
          providerRef: event.providerRef,
          failReason: event.failReason,
          payload: JSON.stringify({ source: "return", ...event }),
        });
      }
    } catch (error) {
      // The order page still shows; a callback can still land later.
      console.error(`[payments] ${provider} finalize failed`, error);
    }
  }

  return payment.order.number;
}

/* ------------------------------------------------------------------ */
/* Housekeeping                                                        */
/* ------------------------------------------------------------------ */

/**
 * Closes attempts nobody came back to.
 *
 * Without this an abandoned checkout leaves a `pending` payment for ever, and
 * the dashboard cannot tell "waiting for the shopper" from "quietly broken".
 */
export async function expireStalePayments(): Promise<number> {
  const { count } = await prisma.payment.updateMany({
    where: {
      state: { in: ["pending", "authorized"] },
      expiresAt: { lt: new Date() },
    },
    data: {
      state: "expired",
      failReason: "no response from the gateway in time",
    },
  });
  return count;
}
