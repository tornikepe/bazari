import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Deleting the bytes behind a photo nobody points at any more.
 *
 * Uploads are stored as rows, and taking a picture off a product only removed
 * the URL from its list — the row stayed, unreferenced and unreachable, for
 * ever. Fifteen runs of the gallery test left fifteen of them, which is how it
 * was noticed; a shop whose owner re-photographs a product every season would
 * accumulate them the same way, just slower.
 *
 * Only images this application stores are considered. A pasted link to another
 * site is not ours to delete, and the placeholder is shared by every product
 * that has no photo of its own.
 */

const OWN_IMAGE = /^\/api\/images\/([a-z0-9]+)$/i;

/**
 * Forgets any of `urls` that no product refers to any more.
 *
 * Called *after* the product has been saved, so what the database holds is the
 * new state: an image still in use by the product that just dropped it — or by
 * any other — is found by the count and left alone. Doing it before the save
 * would delete a photo that is about to be re-attached.
 */
export async function forgetUnusedImages(urls: string[]): Promise<number> {
  const ids = [...new Set(urls)]
    .map((url) => OWN_IMAGE.exec(url)?.[1])
    .filter((id): id is string => id !== undefined);

  if (ids.length === 0) return 0;

  const unused: string[] = [];

  for (const id of ids) {
    const url = `/api/images/${id}`;
    const stillUsed = await prisma.product.count({
      where: { OR: [{ image: url }, { images: { has: url } }] },
    });
    if (stillUsed === 0) unused.push(id);
  }

  if (unused.length === 0) return 0;

  const { count } = await prisma.productImage.deleteMany({ where: { id: { in: unused } } });
  return count;
}

/** Every photo a product refers to, main one first. */
export function photosOf(product: { image: string; images: string[] }): string[] {
  return [product.image, ...product.images];
}
