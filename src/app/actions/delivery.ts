"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export type DeliveryZoneResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "failed" };

function text(form: FormData, key: string, max = 80) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

/**
 * Lari typed by a person, tetri stored — the same boundary the settings form
 * uses. `null` on nonsense so the caller refuses the save, and `null` on an
 * empty optional field so "no threshold of its own" is expressible.
 */
function tetri(form: FormData, key: string): number | null | "invalid" {
  const raw = String(form.get(key) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return "invalid";
  return Math.round(parsed * 100);
}

/** Every page that quotes a delivery price. */
function revalidate() {
  revalidatePath("/dashboard/settings");
  revalidatePath("/checkout");
  revalidatePath("/cart");
}

/**
 * Creates or updates a zone.
 *
 * `getCurrentAdmin` and not `getCurrentStaff`: a viewer reads the list and
 * changes none of it, and this action takes a POST from anywhere.
 */
export async function saveDeliveryZone(formData: FormData): Promise<DeliveryZoneResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const id = text(formData, "id", 40) || null;
  const nameKa = text(formData, "nameKa");
  const nameEn = text(formData, "nameEn");
  const fee = tetri(formData, "fee");
  const freeAbove = tetri(formData, "freeAbove");

  // Both names: the checkout is bilingual and a zone with one name would be
  // blank in the other language. A fee is required; a threshold is not.
  if (!nameKa || !nameEn || fee === null || fee === "invalid" || freeAbove === "invalid") {
    return { ok: false, error: "invalid" };
  }

  const sortOrder = Math.max(0, Math.floor(Number(formData.get("sortOrder")) || 0));
  const data = { nameKa, nameEn, fee, freeAbove, sortOrder, isActive: formData.get("isActive") === "on" };

  try {
    if (id) {
      await prisma.deliveryZone.update({ where: { id }, data });
    } else {
      await prisma.deliveryZone.create({ data });
    }
  } catch (error) {
    console.error("saveDeliveryZone failed", error);
    return { ok: false, error: "failed" };
  }

  revalidate();
  return { ok: true };
}

/**
 * Removes a zone.
 *
 * Allowed outright, unlike a coupon: orders keep the zone's name in their own
 * columns and only the pointer goes to null, so nothing an old order says
 * about where it went is lost.
 */
export async function deleteDeliveryZone(id: string): Promise<DeliveryZoneResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };
  if (typeof id !== "string" || !id) return { ok: false, error: "invalid" };

  try {
    await prisma.deliveryZone.delete({ where: { id } });
  } catch (error) {
    console.error("deleteDeliveryZone failed", error);
    return { ok: false, error: "failed" };
  }

  revalidate();
  return { ok: true };
}
