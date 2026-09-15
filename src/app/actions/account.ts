"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

export type RecentOrder = {
  number: string;
  createdAt: string;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items: number;
};

/**
 * The signed-in customer's last few orders, for the panel under the
 * account icon. Their own and nobody else's: the id comes from the session
 * cookie, not from the caller. Empty for staff and for a visitor.
 */
export async function recentOrders(): Promise<RecentOrder[]> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return [];

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      number: true,
      createdAt: true,
      total: true,
      status: true,
      paymentStatus: true,
      _count: { select: { items: true } },
    },
  });

  return orders.map((order) => ({
    number: order.number,
    createdAt: order.createdAt.toISOString(),
    total: order.total,
    status: order.status,
    paymentStatus: order.paymentStatus,
    items: order._count.items,
  }));
}
