"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { isOrderStatus } from "@/lib/order-status";
import type { Prisma } from "@/generated/prisma/client";

const DEFAULT_IMAGE = "/products/placeholder.svg";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "slug-taken" | "has-products" | "failed" };

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
  | { ok: false; error: "invalid" | "slug-taken" }
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
  const price = number(formData, "price");

  if (!nameKa || !nameEn || !categoryId || price <= 0) return { ok: false, error: "invalid" };

  // Fall back to a transliterated name so the slug is never empty.
  const slug = slugify(text(formData, "slug") || nameEn || nameKa);
  if (!slug) return { ok: false, error: "invalid" };

  const clash = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== currentId) return { ok: false, error: "slug-taken" };

  const oldPriceRaw = text(formData, "oldPrice");
  const oldPrice = oldPriceRaw ? Number(oldPriceRaw) : null;

  return {
    ok: true,
    data: {
      slug,
      nameKa,
      nameEn,
      descriptionKa: text(formData, "descriptionKa"),
      descriptionEn: text(formData, "descriptionEn"),
      price,
      // An "old price" below the current one would render a negative discount.
      oldPrice: oldPrice !== null && Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : null,
      stock: Math.max(0, Math.floor(number(formData, "stock"))),
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
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  // Narrows the incoming string to the schema enum — this is a Server Action,
  // so `status` can be anything a POST body contains.
  if (!isOrderStatus(status)) return { ok: false, error: "invalid" };

  try {
    await prisma.order.update({ where: { id }, data: { status } });
  } catch (error) {
    console.error("updateOrderStatus failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  return { ok: true };
}
