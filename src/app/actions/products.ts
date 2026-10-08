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

/** How many ids one call will look at. The list comes from the client. */
const SELLABLE_BATCH = 100;

/** The ids out of `asked` that `found` did not come back with. */
function missing(asked: string[], found: { id: string }[]): string[] {
  const here = new Set(found.map((row) => row.id));
  return asked.filter((id) => !here.has(id));
}

/**
 * Of these products and these combinations, which the shop still sells.
 *
 * Answers about exactly the ids it was given and no more, which is what lets
 * the caller treat "asked about, not returned" as "gone" and clear it out of
 * a cart or a wishlist. A longer list than it will look at is refused rather
 * than silently truncated — a truncated answer read that way would delete
 * everything past the hundredth.
 *
 * Combinations are asked about separately because a cart line names one: a
 * product can be perfectly on sale with the size in somebody's basket taken
 * off it, and that line cannot be ordered either.
 */
export async function sellableProducts(
  productIds: string[],
  variantIds: string[] = [],
): Promise<{ gone: string[] }> {
  const clean = (ids: string[]) => [
    ...new Set(ids.filter((id) => typeof id === "string" && id.length > 0)),
  ];
  const products = clean(productIds);
  const variants = clean(variantIds);

  if (products.length > SELLABLE_BATCH || variants.length > SELLABLE_BATCH) {
    throw new Error(`sellableProducts: at most ${SELLABLE_BATCH} ids of each per call`);
  }
  if (products.length === 0 && variants.length === 0) return { gone: [] };

  const [liveProducts, liveVariants] = await Promise.all([
    products.length > 0
      ? prisma.product.findMany({
          where: { id: { in: products }, isActive: true },
          select: { id: true },
        })
      : [],
    variants.length > 0
      ? prisma.productVariant.findMany({
          // The product has to be on sale too: a combination of a withdrawn
          // product is itself withdrawn, whatever its own flag says.
          where: { id: { in: variants }, isActive: true, product: { isActive: true } },
          select: { id: true },
        })
      : [],
  ]);

  return { gone: [...missing(products, liveProducts), ...missing(variants, liveVariants)] };
}
