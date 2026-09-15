"use server";

import { prisma } from "@/lib/prisma";
import { orderHistory } from "@/lib/order-status";
import { getLocale } from "@/lib/locale";
import type { OrderStatus } from "@/lib/order-status";
import type { PaymentMethod, PaymentStatus } from "@/lib/payment";

/**
 * Looks up an order for the storefront tracking page.
 *
 * The order number alone is not a secret worth much, so the phone number is
 * required as a second factor — otherwise anyone could enumerate order numbers
 * and read customers' names and addresses.
 *
 * What comes back is what the person who placed the order already knows: what
 * they bought, what they agreed to pay, and where it has got to. Deliberately
 * *not* returned: the delivery address, the customer's name and email, and the
 * notes staff write on an order — those are either already known to the right
 * reader or were never meant for them.
 */
export type TrackedItem = {
  name: string;
  quantity: number;
  price: number;
  image: string;
};

/** One step the order has actually reached, newest last. */
export type TrackedStep = {
  status: OrderStatus;
  at: string;
};

export type TrackResult =
  | {
      ok: true;
      number: string;
      status: OrderStatus;
      createdAt: string;
      itemCount: number;
      subtotal: number;
      shipping: number;
      discount: number;
      total: number;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      items: TrackedItem[];
      /** The recorded history, which is what makes this a timeline and not a badge. */
      history: TrackedStep[];
    }
  | { ok: false; error: "not-found" | "invalid" };

export async function trackOrder(orderNumber: string, phone: string): Promise<TrackResult> {
  const number = orderNumber.trim().toUpperCase();
  const digits = phone.replace(/\D/g, "");

  if (!number || digits.length < 9) return { ok: false, error: "invalid" };

  const order = await prisma.order.findUnique({
    where: { number },
    select: {
      number: true,
      phone: true,
      status: true,
      subtotal: true,
      shipping: true,
      discount: true,
      total: true,
      createdAt: true,
      shippedAt: true,
      deliveredAt: true,
      paymentMethod: true,
      paymentStatus: true,
      items: {
        select: { nameKa: true, nameEn: true, quantity: true, price: true, image: true },
      },
      /* Status only. Staff notes live on the same rows and are written for the
         shop, not for the customer. */
      events: { select: { status: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });

  // Compare digits only — the stored number may carry spaces or a +995 prefix.
  if (!order || !order.phone.replace(/\D/g, "").endsWith(digits.slice(-9))) {
    return { ok: false, error: "not-found" };
  }

  const locale = await getLocale();

  const history = orderHistory(order);

  return {
    ok: true,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    items: order.items.map((item) => ({
      name: locale === "ka" ? item.nameKa : item.nameEn,
      quantity: item.quantity,
      price: item.price,
      image: item.image,
    })),
    history,
  };
}
