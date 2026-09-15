"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { consume } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { BODY_MAX, isRating, mayReview, PHOTOS_MAX, TITLE_MAX } from "@/lib/review-rules";
import { checkUpload } from "@/lib/image-upload";
import type { Prisma } from "@/generated/prisma/client";

export type SubmitReviewResult =
  | { ok: true }
  | {
      ok: false;
      error: "sign-in-required" | "not-found" | "not-bought" | "not-delivered" | "invalid" | "rate-limited" | "failed";
    };

/**
 * Keeps the two figures on the product equal to its published rows.
 *
 * Recomputed rather than incremented: an increment is right until one write
 * fails halfway, and then it is wrong for ever. Two integers read from the
 * rows are right every time.
 */
async function refreshRating(tx: Prisma.TransactionClient, productId: string) {
  const rows = await tx.review.aggregate({
    where: { productId, isPublished: true },
    _sum: { rating: true },
    _count: { _all: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { ratingSum: rows._sum.rating ?? 0, ratingCount: rows._count._all },
  });
}

/**
 * A customer writing, or rewriting, what they thought.
 *
 * The right to write is checked here from the orders, not trusted from the
 * form: this is a Server Action and takes a POST from anywhere. A second
 * review of the same product replaces the first — pictures included: the
 * ones sent are the ones kept, and the ones kept from before that the form
 * still lists are named in `keep`.
 *
 * A `FormData` rather than an object, because pictures travel that way.
 * Each is read for what it is (see `image-upload.ts`), not for what the
 * browser called it.
 */
export async function submitReview(formData: FormData): Promise<SubmitReviewResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return { ok: false, error: "sign-in-required" };

  const throttle = await consume(`review:user:${user.id}`, 20, 60 * 60);
  if (!throttle.ok) return { ok: false, error: "rate-limited" };

  const rating = Number(formData.get("rating"));
  const title = String(formData.get("title") ?? "").trim().slice(0, TITLE_MAX);
  const body = String(formData.get("body") ?? "").trim().slice(0, BODY_MAX);
  const slug = String(formData.get("slug") ?? "");
  if (!isRating(rating)) return { ok: false, error: "invalid" };

  const keep = formData
    .getAll("keep")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const photos: { data: Uint8Array<ArrayBuffer>; contentType: string }[] = [];
  for (const value of formData.getAll("photo")) {
    if (!(value instanceof File)) continue;
    const bytes = new Uint8Array(await value.arrayBuffer());
    const checked = checkUpload(bytes);
    if (!checked.ok) return { ok: false, error: "invalid" };
    photos.push({ data: bytes, contentType: checked.type });
  }
  if (keep.length + photos.length > PHOTOS_MAX) return { ok: false, error: "invalid" };

  const product = await prisma.product.findUnique({
    where: { slug },
    select: { id: true, nameEn: true },
  });
  if (!product) return { ok: false, error: "not-found" };

  const orders = await prisma.order.findMany({
    where: { userId: user.id, items: { some: { productId: product.id } } },
    select: { id: true, status: true },
  });
  const allowed = mayReview(true, orders);
  if (!allowed.ok) return { ok: false, error: allowed.reason === "sign-in" ? "sign-in-required" : allowed.reason };

  try {
    await prisma.$transaction(async (tx) => {
      const review = await tx.review.upsert({
        where: { productId_userId: { productId: product.id, userId: user.id } },
        create: { productId: product.id, userId: user.id, orderId: allowed.orderId, rating, title, body },
        // A rewrite is published again: the shop hid what was written, and
        // what is written now is different.
        update: { rating, title, body, isPublished: true },
        select: { id: true },
      });
      // The pictures the form no longer lists go; the new ones come. The
      // ids to keep are checked against this review's own, so a form
      // cannot name somebody else's picture into its list.
      await tx.reviewPhoto.deleteMany({
        where: { reviewId: review.id, ...(keep.length > 0 ? { id: { notIn: keep } } : {}) },
      });
      if (photos.length > 0) {
        await tx.reviewPhoto.createMany({
          data: photos.map((photo) => ({ reviewId: review.id, ...photo })),
        });
      }
      await refreshRating(tx, product.id);
    });
  } catch (error) {
    console.error("submitReview failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath(`/product/${slug}`);
  revalidatePath("/catalog");
  revalidatePath("/dashboard/reviews");
  return { ok: true };
}

export type ReviewAdminResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "failed" };

/**
 * Hides a review, or shows it again. Never edits one: a star the shop can
 * move is not a star, and a sentence the shop can rewrite is the shop's.
 */
export async function setReviewPublished(id: string, isPublished: boolean): Promise<ReviewAdminResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };
  if (typeof id !== "string" || !id) return { ok: false, error: "invalid" };

  let review: { productId: string; isPublished: boolean; product: { slug: string; nameEn: string } } | null = null;
  try {
    review = await prisma.$transaction(async (tx) => {
      const before = await tx.review.findUnique({
        where: { id },
        select: { productId: true, isPublished: true, product: { select: { slug: true, nameEn: true } } },
      });
      if (!before) return null;
      await tx.review.update({ where: { id }, data: { isPublished } });
      await refreshRating(tx, before.productId);
      return before;
    });
  } catch (error) {
    console.error("setReviewPublished failed", error);
    return { ok: false, error: "failed" };
  }
  if (!review) return { ok: false, error: "invalid" };

  await audit({
    actor: admin.email,
    action: "review.publish",
    entityId: id,
    label: review.product.nameEn,
    changes: { isPublished: [review.isPublished, isPublished] },
  });

  revalidatePath(`/product/${review.product.slug}`);
  revalidatePath("/catalog");
  revalidatePath("/dashboard/reviews");
  return { ok: true };
}
