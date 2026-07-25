"use server";

import { prisma } from "@/lib/prisma";
import { productCardSelect, type ProductCardData } from "@/lib/catalog";

/**
 * Resolves wishlist ids into product cards.
 *
 * The wishlist lives in localStorage (ids only), so the page hands the ids
 * back to the server to fetch current names, prices and stock rather than
 * caching stale copies in the browser.
 */
export async function getProductsByIds(ids: string[]): Promise<ProductCardData[]> {
  const clean = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (clean.length === 0) return [];

  // Bound the query — the id list comes from the client.
  const products = await prisma.product.findMany({
    where: { id: { in: clean.slice(0, 100) }, isActive: true },
    select: productCardSelect,
  });

  // Preserve the order the ids were saved in (newest last).
  const byId = new Map(products.map((product) => [product.id, product]));
  return clean.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
}
