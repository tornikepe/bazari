"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { sendOrderShippedEmail } from "@/lib/order-emails";
import { getLocale } from "@/lib/locale";
import { slugify } from "@/lib/format";
import { generateSku } from "@/lib/sku";
import { isOrderStatus } from "@/lib/order-status";
import type { Prisma } from "@/generated/prisma/client";

const DEFAULT_IMAGE = "/products/placeholder.svg";

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "unauthorized" | "invalid" | "slug-taken" | "sku-taken" | "has-products" | "failed";
    };

/**
 * Server Actions are reachable by direct POST, so the session is verified here
 * rather than relying on the panel layout's redirect.
 */
async function requireAdmin() {
  const admin = await getCurrentAdmin();
  return admin !== null;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function number(formData: FormData, key: string, fallback = 0) {
  const parsed = Number(formData.get(key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * A money field, converted from what the admin typed to what is stored.
 *
 * The form takes lari with decimals because that is what a person thinks in;
 * everything past this line is whole tetri. This is the only place in the
 * write path where a decimal exists at all.
 */
function tetri(formData: FormData, key: string, fallback = 0) {
  const parsed = Number(formData.get(key));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : fallback;
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

/** Refreshes every surface a catalog change can appear on. */
function revalidateStorefront() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

type ProductFormParse =
  | { ok: false; error: "invalid" | "slug-taken" | "sku-taken" }
  | { ok: true; data: Prisma.ProductUncheckedCreateInput };

// The return type is annotated explicitly so the `ok` discriminant narrows at
// the call site — an inferred union here would leave `error` possibly undefined.
async function readProductForm(
  formData: FormData,
  currentId?: string,
): Promise<ProductFormParse> {
  const nameKa = text(formData, "nameKa");
  const nameEn = text(formData, "nameEn");
  const categoryId = text(formData, "categoryId");
  const price = tetri(formData, "price");

  if (!nameKa || !nameEn || !categoryId || price <= 0) return { ok: false, error: "invalid" };

  // Fall back to a transliterated name so the slug is never empty.
  const slug = slugify(text(formData, "slug") || nameEn || nameKa);
  if (!slug) return { ok: false, error: "invalid" };

  const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== currentId) return { ok: false, error: "slug-taken" };

  const oldPriceRaw = text(formData, "oldPrice");
  const oldPrice = oldPriceRaw ? Math.round(Number(oldPriceRaw) * 100) : null;

  // A blank SKU is generated rather than filled in from the slug. The slug is
  // a URL — it changes when the product is renamed, it can be 60 characters of
  // transliterated Georgian, and neither is any use written on a box. The
  // owner of this shop should never have to know what an SKU is.
  const typed = text(formData, "sku").toUpperCase().slice(0, 32);
  const taken = async (candidate: string) => {
    const clash = await prisma.product.findUnique({
      where: { sku: candidate },
      select: { id: true },
    });
    return clash !== null && clash.id !== currentId;
  };

  let sku = typed;
  if (!sku) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { slug: true },
    });
    const generated = await generateSku(category?.slug ?? "gen", taken);
    if (!generated) return { ok: false, error: "sku-taken" };
    sku = generated;
  } else if (await taken(sku)) {
    return { ok: false, error: "sku-taken" };
  }

  return {
    ok: true,
    data: {
      slug,
      sku,
      nameKa,
      nameEn,
      descriptionKa: text(formData, "descriptionKa"),
      descriptionEn: text(formData, "descriptionEn"),
      price,
      // An "old price" below the current one would render a negative discount.
      oldPrice: oldPrice !== null && Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : null,
      stock: Math.max(0, Math.floor(number(formData, "stock"))),
      costPrice: Math.max(0, tetri(formData, "costPrice")),
      lowStockAt: Math.max(0, Math.floor(number(formData, "lowStockAt", 10))),
      image: text(formData, "image") || DEFAULT_IMAGE,
      brand: text(formData, "brand"),
      shippingDays: Math.max(1, Math.floor(number(formData, "shippingDays", 14))),
      isFeatured: checkbox(formData, "isFeatured"),
      isActive: checkbox(formData, "isActive"),
      categoryId,
    },
  };
}

export async function saveProduct(id: string | null, formData: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  const parsed = await readProductForm(formData, id ?? undefined);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    if (id) {
      await prisma.product.update({ where: { id }, data: parsed.data });
    } else {
      await prisma.product.create({ data: parsed.data });
    }
  } catch (error) {
    console.error("saveProduct failed", error);
    return { ok: false, error: "failed" };
  }

  revalidateStorefront();
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  try {
    await prisma.product.delete({ where: { id } });
  } catch (error) {
    console.error("deleteProduct failed", error);
    return { ok: false, error: "failed" };
  }

  revalidateStorefront();
  return { ok: true };
}

/** Inline toggle from the product table. */
export async function toggleProductActive(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  const product = await prisma.product.findUnique({ where: { id }, select: { isActive: true } });
  if (!product) return { ok: false, error: "failed" };

  await prisma.product.update({ where: { id }, data: { isActive: !product.isActive } });

  revalidateStorefront();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export async function saveCategory(id: string | null, formData: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  const nameKa = text(formData, "nameKa");
  const nameEn = text(formData, "nameEn");
  if (!nameKa || !nameEn) return { ok: false, error: "invalid" };

  const slug = slugify(text(formData, "slug") || nameEn || nameKa);
  if (!slug) return { ok: false, error: "invalid" };

  const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== id) return { ok: false, error: "slug-taken" };

  const data = {
    slug,
    nameKa,
    nameEn,
    icon: text(formData, "icon") || "📦",
    sortOrder: Math.floor(number(formData, "sortOrder")),
  };

  try {
    if (id) {
      await prisma.category.update({ where: { id }, data });
    } else {
      await prisma.category.create({ data });
    }
  } catch (error) {
    console.error("saveCategory failed", error);
    return { ok: false, error: "failed" };
  }

  revalidateStorefront();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  // The schema cascades, so this check is what stops a delete from silently
  // taking a category's products with it.
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) return { ok: false, error: "has-products" };

  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    console.error("deleteCategory failed", error);
    return { ok: false, error: "failed" };
  }

  revalidateStorefront();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export async function updateOrderStatus(id: string, status: string): Promise<ActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  // Narrows the incoming string to the schema enum — this is a Server Action,
  // so `status` can be anything a POST body contains.
  if (!isOrderStatus(status)) return { ok: false, error: "invalid" };

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      status: true,
      number: true,
      email: true,
      total: true,
      items: {
        select: { productId: true, quantity: true, nameKa: true, nameEn: true, price: true },
      },
    },
  });
  if (!order) return { ok: false, error: "failed" };
  if (order.status === status) return { ok: true };

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status,
          // Timestamps are only stamped the first time the order reaches each
          // stage, so re-opening an order doesn't rewrite its history.
          ...(status === "shipped" ? { shippedAt: now } : {}),
          ...(status === "delivered" ? { deliveredAt: now, paymentStatus: "paid" } : {}),
          ...(status === "cancelled" ? { paymentStatus: "refunded" } : {}),
        },
      });

      await tx.orderEvent.create({
        data: { orderId: id, status, actor: admin.email },
      });

      // Cancelling releases the reserved stock back to the catalogue, with a
      // ledger row explaining the increase.
      if (status === "cancelled" && order.status !== "cancelled") {
        for (const item of order.items) {
          if (!item.productId) continue;

          const updated = await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
            select: { stock: true },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              delta: item.quantity,
              reason: "return_to_stock",
              balance: updated.stock,
              orderId: id,
              note: "Order cancelled",
            },
          });
        }
      }
    });
  } catch (error) {
    console.error("updateOrderStatus failed", error);
    return { ok: false, error: "failed" };
  }

  // Sent after the transaction commits, and only on the actual transition —
  // re-saving an order that is already `shipped` returns early above, so the
  // customer cannot be mailed the same notice twice.
  if (status === "shipped") {
    await sendOrderShippedEmail({
      to: order.email,
      number: order.number,
      total: order.total,
      items: order.items.map((item) => ({
        nameKa: item.nameKa,
        nameEn: item.nameEn,
        quantity: item.quantity,
        price: item.price,
      })),
      locale: await getLocale(),
    });
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
