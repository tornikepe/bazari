import "server-only";

import { prisma } from "@/lib/prisma";
import { getAdapter, toMinor, PAYMENT_WINDOW_MINUTES } from "@/lib/payments";
import type { Minor, PaymentProvider, PaymentState } from "@/lib/payments/types";

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
  if (order.paymentStatus === "paid") return { ok: false, reason: "already paid" };

  const amount = toMinor(order.total);
  const adapter = getAdapter(provider);
  if (!adapter.isConfigured()) return { ok: false, reason: `${provider} is not configured` };

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      provider,
      amount,
      expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60_000),
    },
    select: { id: true },
  });

  const started = await adapter.start({
    paymentId: payment.id,
    orderNumber: order.number,
    amount,
    currency: "GEL",
    returnUrl: `${origin}/order/${order.number}`,
    webhookUrl: `${origin}/api/payments/${provider}/webhook`,
    locale,
  });

  if (started.kind === "error") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { state: "failed", failReason: started.reason },
    });
    return { ok: false, reason: started.reason };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { providerRef: started.providerRef },
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
  paymentId: string;
  externalId: string;
  state: PaymentState;
  amount: Minor;
  providerRef?: string;
  failReason?: string;
  payload: string;
}): Promise<ApplyResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: input.paymentId },
    select: { id: true, orderId: true, amount: true, state: true },
  });

  if (!payment) return { ok: false, reason: "unknown payment" };

  // A gateway that reports a different figure than we asked for is either
  // misconfigured or being tampered with. Never capture on that.
  if (input.state === "captured" && input.amount !== payment.amount) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        state: "failed",
        failReason: `amount mismatch: gateway ${input.amount}, expected ${payment.amount}`,
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
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: "paid" },
        });
        await tx.orderEvent.create({
          data: { orderId: payment.orderId, status: "pending", note: "Payment received" },
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
    where: { state: { in: ["pending", "authorized"] }, expiresAt: { lt: new Date() } },
    data: { state: "expired", failReason: "no response from the gateway in time" },
  });
  return count;
}
