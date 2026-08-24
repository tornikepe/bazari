"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { sendOrderShippedEmail } from "@/lib/order-emails";
import { getLocale } from "@/lib/locale";
import { slugify } from "@/lib/format";
import { generateSku } from "@/lib/sku";
import { isOrderStatus, type OrderStatus } from "@/lib/order-status";
import { MAX_GALLERY } from "@/lib/image-upload";
import { specsFromForm } from "@/lib/product-specs";
import { forgetUnusedImages, photosOf } from "@/lib/product-images";
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
      /* The extra photos, cleaned here rather than trusted from the form: a
         blank field posts an empty string, and a photo repeated in the list
         would give the gallery two identical thumbnails. Capped so a broken
         client cannot write an unbounded array. */
      images: [...new Set(formData.getAll("images").map((value) => String(value).trim()))]
        .filter((url) => url.length > 0 && url !== text(formData, "image"))
        .slice(0, MAX_GALLERY),
      /* Put through the same parser the product page reads with, so the form
         cannot store a shape the page would then have to reject. */
      specs: specsFromForm(formData),
      brand: text(formData, "brand"),
      shippingDays: Math.max(1, Math.floor(number(formData, "shippingDays", 14))),
      isFeatured: checkbox(formData, "isFeatured"),
      isActive: checkbox(formData, "isActive"),
      categoryId,
    },
  };
}

/**
 * Writes the ledger row that explains a stock figure being set by hand.
 *
 * The schema promises that every change to `Product.stock` leaves a row behind,
 * so "why is this out of stock?" is always answerable. Selling and cancelling
 * kept that promise; the admin form did not — typing a new number in it moved
 * the figure and left no trace at all, which is the one case where a trace is
 * most wanted, because a person did it.
 *
 * `correction` rather than `restock` when the figure goes up, and it is a
 * judgement call worth stating: the form is where somebody fixes a miscount as
 * often as they record a delivery, and the ledger should not claim to know
 * which. A restock button that says so is the right home for `restock`.
 */
async function recordStockChange(
  tx: Prisma.TransactionClient,
  productId: string,
  from: number,
  to: number,
  note: string,
) {
  if (from === to) return;

  await tx.stockMovement.create({
    data: {
      productId,
      delta: to - from,
      reason: "correction",
      balance: to,
      note,
    },
  });
}

export async function saveProduct(id: string | null, formData: FormData): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  const parsed = await readProductForm(formData, id ?? undefined);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  /* What it points at now, so the photos it stops pointing at can have their
     bytes cleaned up after the save. Read before, compared after: an upload
     that is merely being reordered must not be deleted. The stock comes along
     for the ledger row below. */
  const before = id
    ? await prisma.product.findUnique({
        where: { id },
        select: { image: true, images: true, stock: true },
      })
    : null;

  try {
    if (id) {
      await prisma.$transaction(async (tx) => {
        // The figure comes back from the row rather than from the form, so the
        // ledger records what the product actually holds.
        const after = await tx.product.update({
          where: { id },
          data: parsed.data,
          select: { stock: true },
        });
        if (before) {
          await recordStockChange(tx, id, before.stock, after.stock, "Edited in the dashboard");
        }
      });
    } else {
      await prisma.product.create({ data: parsed.data });
    }
  } catch (error) {
    console.error("saveProduct failed", error);
    return { ok: false, error: "failed" };
  }

  if (before) {
    const kept = new Set(photosOf(parsed.data as { image: string; images: string[] }));
    /* Failing to tidy up is not a reason to tell the admin their save failed —
       the save happened. The worst case is a row nobody points at. */
    await forgetUnusedImages(photosOf(before).filter((url) => !kept.has(url))).catch((error) =>
      console.error("forgetUnusedImages failed", error),
    );
  }

  revalidateStorefront();
  return { ok: true };
}

/**
 * One number, changed from the table.
 *
 * Two fields and no more. Price and stock are what a shop owner changes daily
 * and what the form makes them open a page and scroll for; everything else on
 * a product is either prose, which needs a text area, or a decision, which
 * needs the form's context. A general "set any column from the table" action
 * would be a much larger hole in a Server Action reachable by direct POST.
 *
 * `price` arrives in lari because that is what was typed, and is stored in
 * tetri like every other amount here. `stock` writes a ledger row, the same as
 * the form does — a figure that moved with nothing to explain it is exactly
 * what the ledger exists to prevent.
 */
export async function setProductNumber(
  id: string,
  field: "price" | "stock",
  value: number,
): Promise<ActionResult & { value?: number }> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };
  if (field !== "price" && field !== "stock") return { ok: false, error: "invalid" };
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "invalid" };

  const stored = field === "price" ? Math.round(value * 100) : Math.floor(value);
  // A product with no price is not a product; the form refuses it too.
  if (field === "price" && stored <= 0) return { ok: false, error: "invalid" };

  const before = await prisma.product.findUnique({ where: { id }, select: { stock: true } });
  if (!before) return { ok: false, error: "invalid" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { [field]: stored } });
      if (field === "stock") {
        await recordStockChange(tx, id, before.stock, stored, "Set from the product table");
      }
    });
  } catch (error) {
    console.error("setProductNumber failed", error);
    return { ok: false, error: "failed" };
  }

  revalidateStorefront();
  return { ok: true, value: stored };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  const doomed = await prisma.product.findUnique({
    where: { id },
    select: { image: true, images: true },
  });

  try {
    await prisma.product.delete({ where: { id } });
  } catch (error) {
    console.error("deleteProduct failed", error);
    return { ok: false, error: "failed" };
  }

  if (doomed) {
    await forgetUnusedImages(photosOf(doomed)).catch((error) =>
      console.error("forgetUnusedImages failed", error),
    );
  }

  revalidateStorefront();
  return { ok: true };
}

/** Inline toggle from the product table. */
/**
 * Publishes, unpublishes or deletes several products at once.
 *
 * One action rather than a loop of `toggleProductActive` on the client: twenty
 * separate round trips can half-succeed, and a table that ends up in a state
 * nobody asked for is worse than one that refuses. This either applies to all
 * the ids it was given or fails, and it reports how many rows it touched so
 * the page can say so rather than implying it.
 *
 * `publish` and `unpublish` are named, not toggled. "Toggle these twelve" on a
 * mixed selection means twelve different outcomes, and the reader has to work
 * out which — the one thing a bulk action exists to avoid.
 */
export type BulkAction = "publish" | "unpublish" | "delete";

export async function bulkProducts(
  action: BulkAction,
  ids: string[],
): Promise<ActionResult & { count?: number }> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  /* Deduplicated and capped. The ids arrive from a form, so a crafted post can
     carry any number of them; the cap is the page size, which is the most a
     reader can have selected from what they were shown. */
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))].slice(
    0,
    100,
  );
  if (unique.length === 0) return { ok: false, error: "invalid" };

  try {
    if (action === "delete") {
      /* Read first: once the rows are gone their photo lists are gone with
         them, and the bytes behind those photos would be unreachable. */
      const doomed = await prisma.product.findMany({
        where: { id: { in: unique } },
        select: { image: true, images: true },
      });

      const { count } = await prisma.product.deleteMany({ where: { id: { in: unique } } });

      await forgetUnusedImages(doomed.flatMap(photosOf)).catch((error) =>
        console.error("forgetUnusedImages failed", error),
      );

      revalidateStorefront();
      return { ok: true, count };
    }

    const { count } = await prisma.product.updateMany({
      where: { id: { in: unique } },
      data: { isActive: action === "publish" },
    });

    revalidateStorefront();
    return { ok: true, count };
  } catch (error) {
    console.error("bulkProducts failed", error);
    return { ok: false, error: "failed" };
  }
}

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

/**
 * Moves one order, and tells the caller whether it actually moved.
 *
 * Split out of `updateOrderStatus` so that changing twelve orders at once is
 * the same operation twelve times rather than a second implementation of it.
 * That distinction is not cosmetic: cancelling an order returns its stock to
 * the catalogue and writes a ledger row for each line, and a bulk path that
 * only wrote the new status would have quietly sold that stock twice.
 *
 * Returns `"unchanged"` for an order already in the asked-for status, so a
 * selection of twenty of which three move reports three.
 */
async function applyOrderStatus(
  actor: string,
  id: string,
  status: OrderStatus,
): Promise<"changed" | "unchanged" | "failed"> {
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
  if (!order) return "failed";
  if (order.status === status) return "unchanged";

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
        data: { orderId: id, status, actor },
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
    console.error("applyOrderStatus failed", error);
    return "failed";
  }

  // Sent after the transaction commits, and only on the actual transition —
  // an order already `shipped` returned above, so the customer cannot be
  // mailed the same notice twice.
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

  return "changed";
}

export async function updateOrderStatus(id: string, status: string): Promise<ActionResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  // Narrows the incoming string to the schema enum — this is a Server Action,
  // so `status` can be anything a POST body contains.
  if (!isOrderStatus(status)) return { ok: false, error: "invalid" };

  const outcome = await applyOrderStatus(admin.email, id, status);
  if (outcome === "failed") return { ok: false, error: "failed" };

  revalidatePath("/dashboard/orders");
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * The same move, applied to a selection.
 *
 * Sequential rather than in parallel, and deliberately: each one is a
 * transaction that can touch the same product rows as the next — two
 * cancellations of orders holding the same product, run at once, are two
 * increments racing for one stock figure. Twelve orders at a few hundred
 * milliseconds each is a wait; a wrong stock count is a wrong shop.
 */
export async function bulkOrders(
  status: string,
  ids: string[],
): Promise<ActionResult & { count?: number }> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  if (!isOrderStatus(status)) return { ok: false, error: "invalid" };

  /* Deduplicated and capped, like the product path: the ids arrive from a
     form, so a crafted post can carry any number of them. */
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))].slice(
    0,
    100,
  );
  if (unique.length === 0) return { ok: false, error: "invalid" };

  let changed = 0;
  let failed = 0;

  for (const id of unique) {
    const outcome = await applyOrderStatus(admin.email, id, status);
    if (outcome === "changed") changed += 1;
    if (outcome === "failed") failed += 1;
    revalidatePath(`/dashboard/orders/${id}`);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");

  // One failure out of twelve is still a failure worth saying so, but the
  // eleven that moved have moved and the reader needs to know that too.
  if (failed > 0 && changed === 0) return { ok: false, error: "failed" };
  return { ok: true, count: changed };
}
