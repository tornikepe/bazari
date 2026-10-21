import "server-only";
import { prisma } from "@/lib/prisma";
import { parsePhotos } from "@/lib/product-photos";
import { dropPhotos, isStoredPhoto } from "@/lib/photo-store";

/**
 * Deleting the bytes behind a photo nobody points at any more.
 *
 * Uploads are stored as rows, and taking a picture off a product only removed
 * the URL from its list — the row stayed, unreferenced and unreachable, for
 * ever. Fifteen runs of the gallery test left fifteen of them, which is how it
 * was noticed; a shop whose owner re-photographs a product every season would
 * accumulate them the same way, just slower.
 *
 * Only images this application stores are considered — a row of ours or a
 * blob in our own store. A pasted link to another site is not ours to
 * delete, and the placeholder is shared by every product that has no photo
 * of its own.
 */

/**
 * Forgets any of `urls` that no product refers to any more.
 *
 * Called *after* the product has been saved, so what the database holds is the
 * new state: an image still in use by the product that just dropped it — or by
 * any other — is found by the count and left alone. Doing it before the save
 * would delete a photo that is about to be re-attached.
 */
export async function forgetUnusedImages(urls: string[]): Promise<number> {
  const ours = [...new Set(urls)].filter(isStoredPhoto);
  if (ours.length === 0) return 0;

  const unused: string[] = [];

  for (const url of ours) {
    /* `photos` is JSON, so "does any product still point at this?" is a
       containment test rather than an array membership one. The partial object
       matches an element with that URL whatever its alt text says. */
    const stillUsed = await prisma.product.count({
      where: {
        OR: [{ image: url }, { photos: { array_contains: [{ url }] } }],
      },
    });
    if (stillUsed === 0) unused.push(url);
    // Said out loud either way. An image kept because a product still points
    // at it is the correct outcome and the one a reader wants explained.
    else console.info(`[images] kept ${url}: still used by ${stillUsed} product(s)`);
  }

  if (unused.length === 0) return 0;

  const gone = await dropPhotos(unused);
  console.info(`[images] forgot ${gone} of ${unused.length}`);
  return gone;
}

/** Every URL a product refers to, main one first. */
export function photosOf(product: { image: string; photos: unknown }): string[] {
  return [...new Set([product.image, ...parsePhotos(product.photos).map((photo) => photo.url)])];
}
