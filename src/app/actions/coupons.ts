"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * Creating and retiring discount codes.
 *
 * The rules that *apply* a coupon already live in `checkCoupon`, and nothing
 * here duplicates them: this writes the row, that reads it. A second copy of
 * "is it expired" would eventually disagree with the first, and the one the
 * customer meets is the one in `checkCoupon`.
 */
export type CouponResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "taken" | "failed" };

/** Percent or amount, never both — the two are different offers. */
export type CouponKind = "percent" | "amount";

function requireAdmin() {
  return getCurrentAdmin();
}

export async function saveCoupon(formData: FormData): Promise<CouponResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  const id = String(formData.get("id") ?? "").trim();

  /* Upper-cased and stripped of spaces, because a customer typing "welcome 10"
     into a field is asking for WELCOME10 and a code that only works when
     copied exactly is a code that mostly does not work. */
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  const kind = formData.get("kind") === "amount" ? "amount" : "percent";
  const value = Math.floor(Number(formData.get("value") ?? 0));
  const minOrder = Math.max(0, Math.floor(Number(formData.get("minOrderTotal") ?? 0) * 100));
  const maxUsesRaw = String(formData.get("maxUses") ?? "").trim();
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();

  if (!/^[A-Z0-9-]{3,24}$/.test(code)) return { ok: false, error: "invalid" };
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: "invalid" };
  // A "100% off" coupon is a free order, and a percentage above it is nonsense.
  if (kind === "percent" && value > 100) return { ok: false, error: "invalid" };

  const data = {
    code,
    percentOff: kind === "percent" ? value : null,
    // Entered in lari, stored in tetri — the same boundary as every other
    // price in this shop.
    amountOff: kind === "amount" ? value * 100 : null,
    minOrderTotal: minOrder,
    maxUses: maxUsesRaw === "" ? null : Math.max(1, Math.floor(Number(maxUsesRaw))),
    expiresAt: expiresRaw === "" ? null : new Date(`${expiresRaw}T23:59:59`),
    isActive: formData.get("isActive") !== "off",
  };

  if (data.expiresAt && Number.isNaN(data.expiresAt.getTime())) {
    return { ok: false, error: "invalid" };
  }

  try {
    if (id) await prisma.coupon.update({ where: { id }, data });
    else await prisma.coupon.create({ data });
  } catch (error) {
    // The code is the only unique column, so a clash is the likely cause and
    // the one the reader can do something about.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { ok: false, error: "taken" };
    }
    console.error("saveCoupon failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/dashboard/coupons");
  return { ok: true };
}

/**
 * Turns a code off. Never deletes it.
 *
 * Orders point at the coupon they were placed with, and deleting the row
 * would blank that on every one of them — the discount would still be in the
 * total with nothing left to explain it. Deactivating stops it being accepted
 * and leaves the history readable.
 */
export async function setCouponActive(id: string, isActive: boolean): Promise<CouponResult> {
  if (!(await requireAdmin())) return { ok: false, error: "unauthorized" };

  try {
    await prisma.coupon.update({ where: { id }, data: { isActive } });
  } catch (error) {
    console.error("setCouponActive failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/dashboard/coupons");
  return { ok: true };
}
