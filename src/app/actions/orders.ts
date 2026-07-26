"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/cart-rules";

export type PlaceOrderInput = {
  customerName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  note: string;
  /** Only ids and quantities — prices are re-read from the database. */
  items: { productId: string; quantity: number }[];
};

export type PlaceOrderResult =
  | { ok: true; number: string }
  | { ok: false; error: "empty" | "invalid" | "unavailable" | "failed" };

/** `BZ-` + 8 random hex chars; retried on the (unique) `number` column. */
function generateOrderNumber() {
  return `BZ-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const customerName = input.customerName?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const city = input.city?.trim() ?? "";
  const address = input.address?.trim() ?? "";

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

  // Attach the order to the signed-in customer, if there is one — guests can
  // still check out, their orders simply have no owner.
  const user = await getCurrentUser();

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

  const subtotal =
    Math.round(lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0) * 100) / 100;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = Math.round((subtotal + shipping) * 100) / 100;

  // A few attempts in case two orders draw the same random number.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            number: generateOrderNumber(),
            userId: user?.role === "customer" ? user.id : null,
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
            discount: 0,
            total,
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
          },
        });

        for (const { product, quantity } of lines) {
          const updated = await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: quantity } },
            select: { stock: true },
          });

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

        return created;
      });

      return { ok: true, number: order.number };
    } catch (error) {
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
