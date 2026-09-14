"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { getCurrentAdmin } from "@/lib/auth";
import { getAdapter, fromMinor } from "@/lib/payments";
import { expireStalePayments } from "@/lib/payments/service";

export type PaymentActionResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "not-refundable" | "failed"; detail?: string };

/**
 * Marks a manual payment (cash on delivery, bank transfer) as received.
 *
 * Gateways capture themselves via the webhook; this is the human equivalent
 * for money handed to a courier, so both routes end at the same place.
 */
export async function markPaymentReceived(paymentId: string): Promise<PaymentActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      orderId: true,
      provider: true,
      state: true,
      amount: true,
      order: { select: { number: true } },
    },
  });

  if (!payment) return { ok: false, error: "invalid" };
  if (payment.provider !== "manual") return { ok: false, error: "invalid" };
  if (payment.state === "captured") return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { state: "captured", capturedAt: new Date() },
    });
    await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: "paid" } });
    await tx.orderEvent.create({
      data: {
        orderId: payment.orderId,
        status: "pending",
        note: `Payment marked received by ${admin.email}`,
      },
    });
  });

  await audit({
    actor: admin.email,
    action: "payment.received",
    entity: "order",
    entityId: payment.orderId,
    label: payment.order.number,
    changes: { paymentState: [payment.state, "captured"], amount: [payment.amount, payment.amount] },
  });

  revalidatePath("/dashboard/orders");
  return { ok: true };
}

/**
 * Refunds a captured payment and puts the goods back on the shelf.
 *
 * Stock is returned through the same ledger every other movement uses, so the
 * running balance on the product page stays the whole truth.
 */
export async function refundPayment(paymentId: string): Promise<PaymentActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { items: true } } },
  });

  if (!payment) return { ok: false, error: "invalid" };
  if (payment.state !== "captured") return { ok: false, error: "not-refundable" };

  const outstanding = payment.amount - payment.refunded;
  if (outstanding <= 0) return { ok: false, error: "not-refundable" };

  // Ask the gateway first: if the money cannot actually be sent back, the
  // database must not claim otherwise.
  const adapter = getAdapter(payment.provider);
  const sent = await adapter.refund(payment.providerRef ?? "", outstanding);

  if (!sent.ok && payment.provider !== "manual") {
    return { ok: false, error: "failed", detail: sent.reason };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { state: "refunded", refunded: payment.amount },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: "refunded" },
    });

    // Only return stock for an order that was not already cancelled, or the
    // units would be credited twice.
    if (payment.order.status !== "cancelled") {
      /* And not for what a return already put back. A return marked received
         restocks its lines through the ledger; refunding the payment after
         that — which is the natural next step — restocked them a second
         time. What came back through a return is subtracted per line. */
      const returned = await tx.returnItem.findMany({
        where: {
          request: { orderId: payment.orderId, status: { in: ["received", "refunded"] } },
        },
        select: { orderItemId: true, quantity: true },
      });
      const alreadyBack = new Map<string, number>();
      for (const line of returned) {
        alreadyBack.set(line.orderItemId, (alreadyBack.get(line.orderItemId) ?? 0) + line.quantity);
      }

      for (const item of payment.order.items) {
        // `productId` is null when the product was deleted after the sale —
        // the line survives for the invoice, but there is no shelf to restock.
        if (!item.productId) continue;

        const quantity = Math.max(0, item.quantity - (alreadyBack.get(item.id) ?? 0));
        if (quantity === 0) continue;

        // The combination's own pile as well as the product's sum, the way
        // the sale took from both.
        if (item.variantId) {
          await tx.productVariant.updateMany({
            where: { id: item.variantId },
            data: { stock: { increment: quantity } },
          });
        }

        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: quantity } },
          select: { stock: true },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            delta: quantity,
            reason: "return_to_stock",
            balance: updated.stock,
            orderId: payment.orderId,
            note: `Refund of ${fromMinor(outstanding)} GEL`,
          },
        });
      }

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: "cancelled" },
      });
    }

    await tx.orderEvent.create({
      data: {
        orderId: payment.orderId,
        status: "cancelled",
        note: `Refunded ${fromMinor(outstanding)} GEL by ${admin.email}`,
      },
    });
  });

  await audit({
    actor: admin.email,
    action: "payment.refund",
    entity: "order",
    entityId: payment.orderId,
    label: payment.order.number,
    changes: { refunded: [payment.refunded, payment.amount] },
  });

  revalidatePath("/dashboard/orders");
  return { ok: true };
}

/** Sweeps abandoned attempts. Safe to call from a cron or by hand. */
export async function sweepStalePayments(): Promise<{ expired: number }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { expired: 0 };
  return { expired: await expireStalePayments() };
}
