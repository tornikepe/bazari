import "server-only";

import { del, put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import type { ImageType } from "@/lib/image-upload";

/**
 * Where a product photograph is kept.
 *
 * It used to be one answer: a row in Postgres, served back through
 * `/api/images/<id>`. That is simple and it needs no second service, and for
 * a long time it was the right trade. It stopped being right when the
 * photographs reached forty-six megabytes against one megabyte of shop —
 * ninety-eight per cent of the database was pictures — and when every one of
 * them cost a database query to serve. A free database plan is spent by that,
 * and the day it is spent the shop has no catalogue.
 *
 * So there are two answers now, and which one is used depends on whether the
 * deployment has a blob store:
 *
 * - **With `BLOB_READ_WRITE_TOKEN`** the bytes go to Vercel Blob and the URL
 *   is absolute. The CDN serves it, the database never sees it again, and the
 *   photographs stop counting against the database at all.
 * - **Without one** the bytes go into Postgres exactly as before. A clone of
 *   this repository with nothing but `DATABASE_URL` still works, which is a
 *   promise the README makes and this must not break.
 *
 * Both return a URL, and nothing upstream of here knows or cares which kind
 * it got: `Product.image` has always held a string.
 */

/** Whether this deployment has somewhere other than the database to put bytes. */
export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** A Vercel Blob URL, as opposed to one of ours or a link to somebody else. */
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
/** A photo in our own database, served by `/api/images/[id]`. */
const OWN_ROW = /^\/api\/images\/([a-z0-9]+)$/i;

/** Whether this URL is a photograph this shop already keeps, either way. */
export function isStoredPhoto(url: string): boolean {
  return OWN_ROW.test(url) || BLOB_URL.test(url);
}

/**
 * Keeps a photograph and hands back the URL that will fetch it.
 *
 * The name is only a hint: the store makes it unique, because two products
 * photographed by the same phone both arrive as `IMG_0001.jpg` and the second
 * must not replace the first.
 */
export async function storePhoto(
  bytes: Uint8Array,
  contentType: ImageType,
  filename: string,
): Promise<string> {
  const clean = filename.replace(/[^\w.-]+/g, "-").slice(0, 80) || "photo";

  if (blobConfigured()) {
    const { url } = await put(`products/${clean}`, Buffer.from(bytes), {
      access: "public",
      contentType,
      addRandomSuffix: true,
      // A photograph never changes once it is up — a new one is a new URL —
      // so it can be cached for a year at every hop.
      cacheControlMaxAge: 31_536_000,
    });
    return url;
  }

  const row = await prisma.productImage.create({
    data: {
      data: Buffer.from(bytes),
      contentType,
      filename: clean.slice(0, 120),
      bytes: bytes.byteLength,
    },
    select: { id: true },
  });
  return `/api/images/${row.id}`;
}

/**
 * Forgets photographs nobody points at any more, wherever they live.
 *
 * A URL from somewhere else on the internet is not ours to delete, and the
 * placeholder is shared by every product that has no photograph of its own;
 * both are ignored. A blob that has already gone is not an error — the point
 * of the call is that it should not be there.
 */
export async function dropPhotos(urls: string[]): Promise<number> {
  const blobs = urls.filter((url) => BLOB_URL.test(url));
  const rows = urls.flatMap((url) => {
    const id = OWN_ROW.exec(url)?.[1];
    return id ? [id] : [];
  });

  let gone = 0;

  if (blobs.length > 0) {
    try {
      await del(blobs);
      gone += blobs.length;
    } catch (error) {
      console.error("[photos] could not delete from the blob store", error);
    }
  }

  if (rows.length > 0) {
    const { count } = await prisma.productImage.deleteMany({ where: { id: { in: rows } } });
    gone += count;
  }

  return gone;
}
