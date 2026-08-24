"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { SETTINGS_ID } from "@/lib/settings";
import { checkBrandColor } from "@/lib/brand-theme";

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "failed" }
  /**
   * The brand colour was refused. `suggestion` is the nearest colour that does
   * work, so the answer is something the owner can act on rather than a wall.
   */
  | { ok: false; error: "contrast"; reason: "invalid" | "unusable" | "drift"; suggestion?: string };

function text(form: FormData, key: string, max = 200) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

/**
 * A money field, converted from what the shop owner typed to what is stored.
 *
 * The form takes lari with decimals because that is what a person thinks in;
 * everything past this line is whole tetri. Same boundary as the product form,
 * and the only place in this file a decimal exists.
 *
 * Returns `null` rather than a fallback on nonsense, so the caller refuses the
 * whole save instead of silently writing a zero — a shipping fee that quietly
 * became free is the kind of bug nobody notices until the month's accounts.
 */
function tetri(form: FormData, key: string): number | null {
  const raw = String(form.get(key) ?? "").trim().replace(",", ".");
  if (!raw) return null;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return Math.round(parsed * 100);
}

/**
 * Saves the shop's settings.
 *
 * `getCurrentAdmin` rather than `getCurrentStaff`: a viewer can read every one
 * of these values and change none of them, and this action is reachable by
 * direct POST regardless of which buttons the page drew.
 */
export async function saveSettings(formData: FormData): Promise<SettingsResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const name = text(formData, "name", 60);
  // The one field with no sensible empty value: it is the header, the tab and
  // the name on every email the shop sends.
  if (!name) return { ok: false, error: "invalid" };

  const freeShippingThreshold = tetri(formData, "freeShippingThreshold");
  const shippingFee = tetri(formData, "shippingFee");
  if (freeShippingThreshold === null || shippingFee === null) {
    return { ok: false, error: "invalid" };
  }

  // Checked here rather than only in the browser: the colour input is a
  // convenience, and this action takes a POST from anywhere. A colour that fails
  // AA must not reach the stylesheet just because it skipped the form.
  const brandColor = text(formData, "brandColor", 7).toLowerCase();
  const brand = checkBrandColor(brandColor);
  if (!brand.ok) {
    return {
      ok: false,
      error: "contrast",
      reason: brand.reason,
      ...(brand.reason === "drift" ? { suggestion: brand.suggestion } : {}),
    };
  }

  const data = {
    name,
    brandColor,
    titleSuffixKa: text(formData, "titleSuffixKa", 60),
    titleSuffixEn: text(formData, "titleSuffixEn", 60),
    taglineKa: text(formData, "taglineKa", 300),
    taglineEn: text(formData, "taglineEn", 300),
    logoUrl: text(formData, "logoUrl", 500),
    contactEmail: text(formData, "contactEmail", 120),
    contactPhone: text(formData, "contactPhone", 60),
    contactAddress: text(formData, "contactAddress", 200),
    contactHoursKa: text(formData, "contactHoursKa", 120),
    contactHoursEn: text(formData, "contactHoursEn", 120),
    freeShippingThreshold,
    shippingFee,
    codEnabled: formData.get("codEnabled") === "on",
  };

  try {
    await prisma.shopSettings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data },
    });
  } catch (error) {
    console.error("saveSettings failed", error);
    return { ok: false, error: "failed" };
  }

  // Every page reads some of this — the header the name, the cart the shipping
  // rules, the footer the contact details — so the whole tree is stale.
  revalidatePath("/", "layout");
  /* And the manifest, which is not in that tree. It is a static route built
     from the same row, so without this an installed shop would keep the name
     and the colour it had at deploy time — the one place a stale value is not
     merely stale but sitting on somebody's home screen. */
  revalidatePath("/manifest.webmanifest");
  return { ok: true };
}
