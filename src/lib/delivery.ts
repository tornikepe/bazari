import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { ZoneRules } from "@/lib/cart-rules";

/** One zone as the checkout and the order pages need it. */
export type DeliveryZoneRow = ZoneRules & {
  id: string;
  nameKa: string;
  nameEn: string;
};

/**
 * The zones a shopper may pick from, in the order the shop put them.
 *
 * Only the active ones: a zone switched off is one the courier no longer goes
 * to, and offering it would sell a delivery nobody can make. Cached per
 * request for the same reason settings are — the checkout page and the
 * action behind it both ask.
 */
export const getActiveZones = cache(async (): Promise<DeliveryZoneRow[]> => {
  const rows = await prisma.deliveryZone.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, nameKa: true, nameEn: true, fee: true, freeAbove: true },
  });
  return rows;
});
