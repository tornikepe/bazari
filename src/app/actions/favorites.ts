"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

/** Never more than this from one browser; the page fetches at most as many. */
const MAX_FAVORITES = 100;

function clean(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return [
    ...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)),
  ].slice(0, MAX_FAVORITES);
}

/**
 * Applies what changed in the browser since the account last answered, and
 * returns the account's whole list.
 *
 * Called once when a signed-in customer arrives. `add` is what this browser
 * has that the account was last known not to — hearts pressed before signing
 * in, or pressed and not delivered — and `remove` is the reverse. Sending the
 * difference rather than the list is what lets a removal survive a lost
 * write: a plain merge would have pressed the heart back. Anything on the
 * account from another browser comes back in the answer.
 *
 * `null` for a guest, which the caller reads as "carry on with the browser's
 * own list". Staff are guests here: the wishlist is a shopper's thing.
 */
export async function syncFavorites(input: {
  add: string[];
  remove: string[];
}): Promise<string[] | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return null;

  const add = clean(input?.add);
  const remove = clean(input?.remove);

  if (remove.length > 0) {
    await prisma.favorite.deleteMany({
      where: { userId: user.id, productId: { in: remove } },
    });
  }

  if (add.length > 0) {
    // Only ids that name a product, so a stale id in the browser cannot fail
    // the whole write on its foreign key.
    const existing = await prisma.product.findMany({
      where: { id: { in: add } },
      select: { id: true },
    });
    await prisma.favorite.createMany({
      data: existing.map(({ id }) => ({ userId: user.id, productId: id })),
      skipDuplicates: true,
    });
  }

  const rows = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { productId: true },
    take: MAX_FAVORITES,
  });
  return rows.map((row) => row.productId);
}

/**
 * One heart, pressed or unpressed.
 *
 * Idempotent in both directions — `createMany … skipDuplicates` and
 * `deleteMany` — because the browser may send the same change twice when two
 * tabs disagree for a moment, and a second "add" must not be an error.
 */
export async function setFavorite(productId: string, on: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return;
  if (typeof productId !== "string" || !productId) return;

  if (on) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) return;
    await prisma.favorite.createMany({
      data: [{ userId: user.id, productId }],
      skipDuplicates: true,
    });
  } else {
    await prisma.favorite.deleteMany({ where: { userId: user.id, productId } });
  }
}

/** The whole list, gone — the "clear" button on the wishlist page. */
export async function clearFavoritesOnAccount(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return;
  await prisma.favorite.deleteMany({ where: { userId: user.id } });
}
