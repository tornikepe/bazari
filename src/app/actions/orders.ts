"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { shippingFor } from "@/lib/cart-rules";
import { getSettings } from "@/lib/settings";
import { checkCoupon } from "@/lib/coupons";
import { isPaymentMethod } from "@/lib/payment";
import { rememberReceipt } from "@/lib/order-access";
import { clientIp, consume } from "@/lib/rate-limit";
import { toMinor, PAYMENT_WINDOW_MINUTES } from "@/lib/payments";
import { sendOrderPlacedEmail } from "@/lib/order-emails";
import { sendLowStockEmail, type LowStockItem } from "@/lib/stock-emails";
import { crossedLowStock } from "@/lib/stock";
import { getLocale } from "@/lib/locale";

export type PlaceOrderInput = {
  customerName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  note: string;
  /** Only ids and quantities — prices are re-read from the database. */
  items: { productId: string; quantity: number }[];
  /** Optional discount code; re-validated server-side before it's applied. */
  couponCode?: string;
  paymentMethod?: string;
};

export type PlaceOrderResult =
  | { ok: true; number: string }
  | {
      ok: false;
      error: "empty" | "invalid" | "unavailable" | "failed" | "rate-limited" | "sign-in-required";
    };

/** Thrown inside the order transaction when a line can no longer be filled. */
class OutOfStockError extends Error {
  constructor() {
    super("out of stock");
    this.name = "OutOfStockError";
  }
}

/** `BZ-` + 8 random hex chars; retried on the (unique) `number` column. */
function generateOrderNumber() {
  return `BZ-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const customerName = input.customerName?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const address = input.address?.trim() ?? "";

  const throttle = await consume(`order:ip:${await clientIp()}`, 10, 60 * 60);
  if (!throttle.ok) return { ok: false, error: "rate-limited" };

  if (!customerName || !phone || !city || !address) return { ok: false, error: "invalid" };
  if (!Array.isArray(input.items) || input.items.length === 0) return { ok: false, error: "empty" };

  // Normalise and de-duplicate before touching the database.
  const wanted = new Map<string, number>();
  for (const item of input.items) {
    if (typeof item?.productId !== "string") continue;
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + quantity);
  }
  if (wanted.size === 0) return { ok: false, error: "empty" };

  // An account is required to buy. Guest checkout used to be allowed, which
  // meant an order could exist with no owner: nobody could look it up later
  // without the emailed receipt link, "my orders" was empty for the person who
  // placed them, and a refund or a delivery question had no verified party on
  // the other end. Checked here and not only in the form — this is a Server
  // Action and is reachable by direct POST.
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "sign-in-required" };

  // Staff accounts are for running the shop, not shopping in it. Letting one
  // order would attach the order to a user the "my orders" page never shows.
  if (user.role !== "customer") return { ok: false, error: "sign-in-required" };

  const products = await prisma.product.findMany({
    where: { id: { in: [...wanted.keys()], }, isActive: true },
  });
  if (products.length !== wanted.size) return { ok: false, error: "unavailable" };

  // Prices come from the database, never from the submitted payload — the
  // cart lives in localStorage and is fully user-editable.
  const lines = products.map((product) => {
    const quantity = Math.min(wanted.get(product.id) ?? 0, product.stock);
    return { product, quantity };
  });

  if (lines.some((line) => line.quantity < 1)) return { ok: false, error: "unavailable" };

  // Tetri throughout: price is a whole number and quantity is an integer, so
  // this sum is exact and needs no rounding at all.
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  // Read here rather than trusted from the client, exactly like the prices
  // above: the cart lives in localStorage and every figure in it is editable.
  const settings = await getSettings();
  const shipping = shippingFor(subtotal, lines.length, settings);

  // The discount is recomputed here rather than trusted from the client, so a
  // tampered request can't invent one.
  let discount = 0;
  let couponId: string | null = null;
  if (input.couponCode) {
    const coupon = await checkCoupon(input.couponCode, subtotal);
    if (coupon.ok) {
      discount = coupon.discount;
      couponId = coupon.id;
    }
  }

  const total = subtotal + shipping - discount;

  // A few attempts in case two orders draw the same random number.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      /* Declared per attempt rather than once: the transaction below can roll
         back and be retried, and an alert about stock that was never taken
         would be a message about nothing. */
      const crossed: LowStockItem[] = [];

      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            number: generateOrderNumber(),
            userId: user.id,
            customerName,
            phone,
            email: input.email?.trim() ?? "",
            city,
            address,
            note: input.note?.trim() ?? "",
            // Stored broken down so the invoice can be reproduced later even
            // if prices or the shipping rules change.
            subtotal,
            shipping,
            discount,
            couponId,
            total,
            paymentMethod: isPaymentMethod(input.paymentMethod)
              ? input.paymentMethod
              : "cash_on_delivery",
            status: "pending",
            items: {
              create: lines.map(({ product, quantity }) => ({
                productId: product.id,
                nameKa: product.nameKa,
                nameEn: product.nameEn,
                sku: product.sku,
                image: product.image,
                price: product.price,
                costPrice: product.costPrice,
                quantity,
              })),
            },
            // Opens the order's timeline; the dashboard appends to it on every
            // status change.
            events: { create: [{ status: "pending", note: "Order placed" }] },

            // Every order gets a payment row from the start, so "is this paid?"
            // has one answer regardless of how the money arrives. Card orders
            // will hand this to a gateway; cash stays `pending` until an admin
            // marks it received.
            payments: {
              create: [
                {
                  provider: "manual",
                  amount: toMinor(total),
                  expiresAt: new Date(Date.now() + PAYMENT_WINDOW_MINUTES * 60_000),
                },
              ],
            },
          },
        });

        for (const { product, quantity } of lines) {
          // Conditional decrement: the `gte` guard is evaluated by the database
          // as part of the write, so two shoppers racing for the last unit
          // cannot both succeed. A plain `update` would read-then-write and let
          // both through, driving stock negative.
          const claimed = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          });

          if (claimed.count === 0) {
            // Someone else took it between the price read and here; the whole
            // transaction rolls back, so no partial order is left behind.
            throw new OutOfStockError();
          }

          const updated = await tx.product.findUniqueOrThrow({
            where: { id: product.id },
            select: { stock: true },
          });

          /* The crossing, and only the crossing: the sale that takes a product
             from above its threshold to at or below it. Collected here because
             this is the one place that knows both figures, and sent after the
             transaction commits — a mail outage must not roll back a sale. */
          if (crossedLowStock(updated.stock + quantity, updated.stock, product.lowStockAt)) {
            crossed.push({
              id: product.id,
              name: product.nameEn || product.nameKa,
              sku: product.sku,
              stock: updated.stock,
              threshold: product.lowStockAt,
            });
          }

          // Every stock change is written to the ledger, so the dashboard can
          // always explain how a product reached its current level.
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              delta: -quantity,
              reason: "sale",
              balance: updated.stock,
              orderId: created.id,
            },
          });
        }

        // Usage is counted inside the transaction, so a coupon can't exceed
        // `maxUses` under concurrent checkouts.
        if (couponId) {
          await tx.coupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
          });
        }

        return created;
      });

      // Lets this browser view the confirmation page for an order placed
      // without an account.
      await rememberReceipt(order.number);

      // Deliberately not awaited into the failure path: the order is already
      // committed, and a mail outage must not turn a paid basket into an error.
      await sendOrderPlacedEmail({
        to: input.email?.trim() ?? "",
        number: order.number,
        total,
        items: lines.map(({ product, quantity }) => ({
          nameKa: product.nameKa,
          nameEn: product.nameEn,
          quantity,
          price: product.price,
        })),
        locale: await getLocale(),
      });

      // Same reasoning, and the same not-awaited-into-the-failure-path: the
      // order is committed either way, and nobody's basket should fail because
      // the shop could not be told to reorder.
      await sendLowStockEmail(crossed).catch((error) =>
        console.error("sendLowStockEmail failed", error),
      );

      return { ok: true, number: order.number };
    } catch (error) {
      if (error instanceof OutOfStockError) return { ok: false, error: "unavailable" };

      const isDuplicateNumber =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";

      if (!isDuplicateNumber) {
        console.error("placeOrder failed", error);
        return { ok: false, error: "failed" };
      }
    }
  }

  return { ok: false, error: "failed" };
}

/* ------------------------------------------------------------------ */

export type CouponPreview =
  | { ok: true; code: string; discount: number }
  | { ok: false; reason: "not-found" | "expired" | "used-up" | "min-total" | "rate-limited" };

/**
 * Checkout's "apply code" button. Returns what the discount *would* be; the
 * real one is recalculated when the order is placed.
 */
export async function previewCoupon(code: string, subtotal: number): Promise<CouponPreview> {
  // Without this, the codes are short enough to simply enumerate.
  const throttle = await consume(`coupon:ip:${await clientIp()}`, 20, 60);
  if (!throttle.ok) return { ok: false, reason: "rate-limited" };

  const result = await checkCoupon(code, Number(subtotal) || 0);
  return result.ok
    ? { ok: true, code: result.code, discount: result.discount }
    : { ok: false, reason: result.reason };
}
