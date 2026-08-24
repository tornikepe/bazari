"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import { SAVED_VIEW_PAGES, isSavedViewPage, type SavedViewPage } from "@/lib/saved-views";

/**
 * Naming a dashboard listing, so it can be come back to.
 *
 * A view is nothing but the query string the toolbar already produces. That is
 * the whole design: no second filter model, no rules to keep in step with the
 * controls, and a view that survives a new filter being added because it was
 * only ever a URL.
 *
 * Saved against the person rather than the shop. Two people running the same
 * dashboard watch different things, and a shared list grows until nobody can
 * find their own.
 */

export type ViewResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "too-many" | "failed" };

/**
 * A ceiling, because this is a row per press of a button.
 *
 * Twelve is more than a dashboard's worth of shortcuts and far fewer than
 * somebody can accumulate by accident; past it the chips would wrap into a
 * wall and stop being shortcuts at all.
 */
const MAX_VIEWS = 12;

export async function saveView(
  page: string,
  name: string,
  query: string,
): Promise<ViewResult> {
  /* `getCurrentStaff`, not `getCurrentAdmin`: a saved view is a shortcut to a
     listing somebody is already allowed to read, and read-only staff have the
     most use for one. Nothing about the shop changes. */
  const staff = await getCurrentStaff();
  if (!staff) return { ok: false, error: "unauthorized" };

  if (!isSavedViewPage(page)) return { ok: false, error: "invalid" };

  const trimmed = name.trim().slice(0, 40);
  if (trimmed.length === 0) return { ok: false, error: "invalid" };

  /* Re-serialised rather than stored as typed. What arrives is a string from
     the browser's address bar, and this is a Server Action, so it can be any
     string at all — round-tripping it through `URLSearchParams` means what is
     stored is a query string and nothing else. */
  const cleaned = new URLSearchParams(query.replace(/^\?/, "")).toString();

  try {
    const existing = await prisma.savedView.findUnique({
      where: { userId_page_name: { userId: staff.id, page, name: trimmed } },
      select: { id: true },
    });

    if (!existing) {
      const count = await prisma.savedView.count({ where: { userId: staff.id, page } });
      if (count >= MAX_VIEWS) return { ok: false, error: "too-many" };
    }

    await prisma.savedView.upsert({
      where: { userId_page_name: { userId: staff.id, page, name: trimmed } },
      update: { query: cleaned },
      create: { userId: staff.id, page, name: trimmed, query: cleaned },
    });
  } catch (error) {
    console.error("saveView failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath(pathOf(page));
  return { ok: true };
}

export async function deleteView(id: string): Promise<ViewResult> {
  /* `getCurrentStaff`, not `getCurrentAdmin`: a saved view is a shortcut to a
     listing somebody is already allowed to read, and read-only staff have the
     most use for one. Nothing about the shop changes. */
  const staff = await getCurrentStaff();
  if (!staff) return { ok: false, error: "unauthorized" };

  try {
    /* Scoped to the owner in the filter rather than checked first: an id
       belonging to somebody else deletes nothing, which is the same answer as
       an id that does not exist — and is the answer that says the least. */
    const { count } = await prisma.savedView.deleteMany({ where: { id, userId: staff.id } });
    if (count === 0) return { ok: false, error: "invalid" };
  } catch (error) {
    console.error("deleteView failed", error);
    return { ok: false, error: "failed" };
  }

  for (const page of SAVED_VIEW_PAGES) revalidatePath(pathOf(page));
  return { ok: true };
}

function pathOf(page: SavedViewPage) {
  return `/dashboard/${page}`;
}
