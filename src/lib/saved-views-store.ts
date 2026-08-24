import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentStaff } from "@/lib/auth";
import type { SavedViewPage } from "@/lib/saved-views";

/**
 * The signed-in staff member's saved views for one listing.
 *
 * Returns nothing rather than throwing when nobody is signed in: the panel
 * layout has already redirected by the time a page renders, and a helper that
 * threw here would turn a session expiring mid-render into a crash instead of
 * a missing row of chips.
 */
export async function getSavedViews(page: SavedViewPage) {
  const staff = await getCurrentStaff();
  if (!staff) return [];

  return prisma.savedView.findMany({
    where: { userId: staff.id, page },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, query: true },
  });
}
