"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getLocale } from "@/lib/locale";
import { sendReturnUpdateEmail } from "@/lib/return-emails";
import { audit } from "@/lib/audit";
import { consume } from "@/lib/rate-limit";
import {
  canMoveReturn,
  isReturnReason,
  isReturnStatus,
  mayRequestReturn,
  type ReturnStatus,
} from "@/lib/returns";

export type RequestReturnInput = {
  orderNumber: string;
  reason: string;
  note: string;
  /** Which lines and how many of each. Empty means every line, in full. */
  items: { orderItemId: string; quantity: number }[];
};

export type RequestReturnResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "sign-in-required"
        | "not-found"
        | "not-delivered"
        | "window-closed"
        | "already-open"
        | "off"
        | "invalid"
        | "rate-limited"
        | "failed";
    };

/**
 * The shopper asking.
 *
 * Ownership is the session's, never the form's: the order number in the
 * payload only says *which* of the caller's orders, and an order that belongs
 * to somebody else does not exist as far as this action is concerned.
 */
export async function requestReturn(input: RequestReturnInput): Promise<RequestReturnResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return { ok: false, error: "sign-in-required" };

  const throttle = await consume(`return:user:${user.id}`, 10, 60 * 60);
  if (!throttle.ok) return { ok: false, error: "rate-limited" };

  if (!isReturnReason(input.reason)) return { ok: false, error: "invalid" };
  const note = String(input.note ?? "").trim().slice(0, 1000);

  const order = await prisma.order.findFirst({
    where: { number: String(input.orderNumber ?? ""), userId: user.id },
    select: {
      id: true,
      status: true,
      deliveredAt: true,
      items: { select: { id: true, quantity: true } },
      returns: { select: { status: true } },
    },
  });
  if (!order) return { ok: false, error: "not-found" };

  const settings = await getSettings();
  const allowed = mayRequestReturn(order, order.returns, settings.returnWindowDays);
  if (!allowed.ok) return { ok: false, error: allowed.reason };

  /* The lines, checked against the order rather than trusted: a quantity
     above what was bought, or a line from another order, is refused. Empty
     means "all of it", which is what most people mean. */
  const byId = new Map(order.items.map((item) => [item.id, item.quantity]));
  const wanted = Array.isArray(input.items) && input.items.length > 0 ? input.items : null;

  const lines = wanted
    ? wanted
        .map((line) => ({
          orderItemId: String(line?.orderItemId ?? ""),
          quantity: Math.floor(Number(line?.quantity)),
        }))
        .filter((line) => line.quantity > 0)
    : order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity }));

  if (lines.length === 0) return { ok: false, error: "invalid" };
  for (const line of lines) {
    const bought = byId.get(line.orderItemId);
    if (bought === undefined || line.quantity > bought) return { ok: false, error: "invalid" };
  }
  if (new Set(lines.map((line) => line.orderItemId)).size !== lines.length) {
    return { ok: false, error: "invalid" };
  }

  try {
    await prisma.returnRequest.create({
      data: {
        orderId: order.id,
        reason: input.reason,
        note,
        items: { create: lines },
      },
    });
  } catch (error) {
    console.error("requestReturn failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath(`/order/${input.orderNumber}`);
  revalidatePath("/dashboard/returns");
  return { ok: true };
}

/* ------------------------------------------------------------------ */

export type ReturnActionResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "not-found" | "failed" };

/**
 * The shop answering.
 *
 * `received` is the one move that touches stock: each line goes back on the
 * shelf through the same ledger a cancellation uses, so "why does this product
 * have one more than it sold?" has the return request as its answer. A line
 * whose product has since been deleted is skipped — there is no shelf to put
 * it on — and the request still moves, because the goods did arrive.
 */
export async function moveReturn(
  id: string,
  status: string,
  staffNote: string,
): Promise<ReturnActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };
  if (typeof id !== "string" || !id || !isReturnStatus(status)) {
    return { ok: false, error: "invalid" };
  }
  const note = String(staffNote ?? "").trim().slice(0, 1000);

  const request = await prisma.returnRequest.findUnique({
    where: { id },
    select: {
      status: true,
      orderId: true,
      order: { select: { number: true, email: true } },
      items: {
        select: {
          quantity: true,
          orderItem: { select: { productId: true, variantId: true, nameEn: true } },
        },
      },
    },
  });
  if (!request) return { ok: false, error: "not-found" };
  if (!canMoveReturn(request.status, status)) return { ok: false, error: "invalid" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id },
        data: {
          status: status as ReturnStatus,
          staffNote: note,
          actor: admin.email,
          // Stamped once, on the first answer.
          ...(request.status === "requested" ? { resolvedAt: new Date() } : {}),
        },
      });

      if (status !== "received") return;

      for (const line of request.items) {
        const { productId, variantId } = line.orderItem;
        if (!productId) continue;

        // The combination's own pile first, while it still exists — the sale
        // took from both, so the return gives back to both.
        if (variantId) {
          await tx.productVariant.updateMany({
            where: { id: variantId },
            data: { stock: { increment: line.quantity } },
          });
        }

        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: line.quantity } },
          select: { stock: true },
        });

        await tx.stockMovement.create({
          data: {
            productId,
            delta: line.quantity,
            reason: "return_to_stock",
            balance: updated.stock,
            orderId: request.orderId,
            note: "Returned by the customer",
          },
        });
      }
    });
  } catch (error) {
    console.error("moveReturn failed", error);
    return { ok: false, error: "failed" };
  }

  await audit({
    actor: admin.email,
    action: "return.move",
    entityId: id,
    label: request.order.number,
    changes: { status: [request.status, status] },
  });

  // After the commit, and never into the failure path: the answer is
  // recorded either way, and a mail outage must not turn it into an error.
  // Written in the language the staff member is using — the shopper's own
  // is not recorded on the order.
  await sendReturnUpdateEmail({
    to: request.order.email,
    number: request.order.number,
    status: status as Exclude<ReturnStatus, "requested">,
    staffNote: note,
    locale: await getLocale(),
  }).catch((error) => console.error("sendReturnUpdateEmail failed", error));

  revalidatePath("/dashboard/returns");
  revalidatePath(`/dashboard/orders/${request.orderId}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/", "layout");
  return { ok: true };
}
