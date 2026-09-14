"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { audit, diff } from "@/lib/audit";

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
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

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
    // An unchecked checkbox is absent from the form, not "off": the old test
    // read absence as on, so the box could be unticked and the code stayed
    // live — only the pause button could ever stop one.
    isActive: formData.get("isActive") === "on",
  };

  if (data.expiresAt && Number.isNaN(data.expiresAt.getTime())) {
    return { ok: false, error: "invalid" };
  }

  const before = id
    ? await prisma.coupon.findUnique({
        where: { id },
        select: {
          code: true,
          percentOff: true,
          amountOff: true,
          minOrderTotal: true,
          maxUses: true,
          expiresAt: true,
          isActive: true,
        },
      })
    : null;

  let createdId: string | null = null;
  try {
    if (id) await prisma.coupon.update({ where: { id }, data });
    else createdId = (await prisma.coupon.create({ data, select: { id: true } })).id;
  } catch (error) {
    // The code is the only unique column, so a clash is the likely cause and
    // the one the reader can do something about.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { ok: false, error: "taken" };
    }
    console.error("saveCoupon failed", error);
    return { ok: false, error: "failed" };
  }

  await audit({
    actor: admin.email,
    action: before ? "coupon.update" : "coupon.create",
    entityId: id || createdId || "",
    label: code,
    changes: before
      ? diff(before, data, [
          "code",
          "percentOff",
          "amountOff",
          "minOrderTotal",
          "maxUses",
          "expiresAt",
          "isActive",
        ])
      : {},
  });

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
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  let coupon: { code: string; isActive: boolean } | null = null;
  try {
    coupon = await prisma.coupon.update({
      where: { id },
      data: { isActive },
      select: { code: true, isActive: true },
    });
  } catch (error) {
    console.error("setCouponActive failed", error);
    return { ok: false, error: "failed" };
  }

  await audit({
    actor: admin.email,
    action: "coupon.active",
    entityId: id,
    label: coupon.code,
    changes: { isActive: [!isActive, isActive] },
  });

  revalidatePath("/dashboard/coupons");
  return { ok: true };
}
