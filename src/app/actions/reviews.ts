"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth";
import { consume } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { BODY_MAX, isRating, mayReview, TITLE_MAX } from "@/lib/review-rules";
import type { Prisma } from "@/generated/prisma/client";

export type SubmitReviewInput = {
  slug: string;
  rating: number;
  title: string;
  body: string;
};

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
 * review of the same product replaces the first.
 */
export async function submitReview(input: SubmitReviewInput): Promise<SubmitReviewResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return { ok: false, error: "sign-in-required" };

  const throttle = await consume(`review:user:${user.id}`, 20, 60 * 60);
  if (!throttle.ok) return { ok: false, error: "rate-limited" };

  const rating = Number(input?.rating);
  const title = String(input?.title ?? "").trim().slice(0, TITLE_MAX);
  const body = String(input?.body ?? "").trim().slice(0, BODY_MAX);
  if (!isRating(rating)) return { ok: false, error: "invalid" };

  const product = await prisma.product.findUnique({
    where: { slug: String(input?.slug ?? "") },
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
      await tx.review.upsert({
        where: { productId_userId: { productId: product.id, userId: user.id } },
        create: { productId: product.id, userId: user.id, orderId: allowed.orderId, rating, title, body },
        // A rewrite is published again: the shop hid what was written, and
        // what is written now is different.
        update: { rating, title, body, isPublished: true },
      });
      await refreshRating(tx, product.id);
    });
  } catch (error) {
    console.error("submitReview failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath(`/product/${input.slug}`);
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
