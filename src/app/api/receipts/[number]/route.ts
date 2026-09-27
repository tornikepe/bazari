import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { readReceipts } from "@/lib/order-access";

/**
 * The photograph of a transfer, for the people entitled to see it.
 *
 * Not public, unlike a product photo or an avatar: a bank slip carries an
 * account number, a name and a sum. Staff may see any of them, because
 * checking one against the bank is the job; a customer may see their own,
 * because they are looking at what they uploaded. Anybody else gets a 404
 * rather than a 403 — an order number that exists should not answer
 * differently from one that does not.
 *
 * "Their own" is the same test the order page itself applies: signed in and
 * the order is theirs, or the signed cookie this browser was given when it
 * placed the order. Most bank transfers are placed by a guest, and a rule
 * that only knew about accounts would have hidden the slip from precisely
 * the people who had just sent it.
 *
 * Never cached by a shared cache, for the same reason.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;

  const order = await prisma.order.findUnique({
    where: { number: number.toUpperCase() },
    select: { number: true, userId: true, receipt: true, receiptType: true },
  });
  if (!order?.receipt || !order.receiptType) return new NextResponse(null, { status: 404 });

  const [user, remembered] = await Promise.all([getCurrentUser(), readReceipts()]);
  const mine =
    Boolean(user && order.userId && order.userId === user.id) || remembered.includes(order.number);
  if (!mine && !(user && isStaff(user.role))) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(order.receipt), {
    headers: {
      "Content-Type": order.receiptType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
