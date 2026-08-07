"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { INFO_SLUGS, type InfoSlug } from "@/lib/info-pages";

export type PageResult = { ok: true } | { ok: false; error: "unauthorized" | "invalid" | "failed" };

function text(form: FormData, key: string, max: number) {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

function isSlug(value: string): value is InfoSlug {
  return (INFO_SLUGS as readonly string[]).includes(value);
}

/**
 * Saves one information page.
 *
 * `getCurrentAdmin`, not `getCurrentStaff` — these pages are the shop's public
 * statements about returns, warranty and privacy, which is exactly the kind of
 * thing a read-only account must not be able to rewrite. Reachable by direct
 * POST regardless of which buttons the editor drew.
 */
export async function savePage(formData: FormData): Promise<PageResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const slug = String(formData.get("slug") ?? "");
  // Bounded to the eight known pages: the slug is a primary key arriving from
  // a form, and an unchecked one would let a POST invent rows.
  if (!isSlug(slug)) return { ok: false, error: "invalid" };

  const data = {
    titleKa: text(formData, "titleKa", 120),
    titleEn: text(formData, "titleEn", 120),
    introKa: text(formData, "introKa", 500),
    introEn: text(formData, "introEn", 500),
    bodyKa: text(formData, "bodyKa", 20_000),
    bodyEn: text(formData, "bodyEn", 20_000),
    isPublished: formData.get("isPublished") === "on",
  };

  try {
    await prisma.infoPage.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  } catch (error) {
    console.error("savePage failed", error);
    return { ok: false, error: "failed" };
  }

  // The footer links these on every page, so the whole tree is stale.
  revalidatePath("/", "layout");
  return { ok: true };
}
