/**
 * Moves the product photographs out of Postgres and into the blob store.
 *
 *     npm run db:backup                     # always first
 *     npx tsx scripts/photos-to-blob.ts     # a dry run: says what it would do
 *     npx tsx scripts/photos-to-blob.ts --yes
 *
 * Why: the photographs were ninety-eight per cent of this database — forty-six
 * megabytes against one megabyte of shop — and every one of them cost a query
 * to serve, because `/api/images/<id>` is a `SELECT`. That is what spends a
 * free database plan, and a spent plan means a shop with no catalogue.
 *
 * What it does, one photograph at a time:
 *
 *   1. reads the row,
 *   2. puts the bytes in the blob store,
 *   3. rewrites every product that pointed at the row to point at the blob,
 *   4. and only then deletes the row.
 *
 * In that order on purpose. A crash between any two steps leaves the shop
 * working: either still pointing at a row that still exists, or already
 * pointing at a blob that already does. The worst case is a blob nobody uses
 * and a row that is deleted on the next run. Nothing is deleted before the
 * thing that replaces it is in place and referred to.
 *
 * It can be run again safely. Rows whose bytes are already in the store are
 * recognised by the product no longer pointing at them, and simply dropped.
 *
 * Transfer slips stay in Postgres and are not touched. A slip is somebody's
 * bank details behind a route that checks who is asking, and the blob store
 * is public — see `src/app/api/receipts`.
 */
import "dotenv/config";
import { put } from "@vercel/blob";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withVerifiedTls } from "../src/lib/db-url";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — copy .env.example to .env");
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set.");
  console.error("  Vercel → the project → Storage → connect a blob store, then");
  console.error("  vercel env pull .env.blob --environment production");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: withVerifiedTls(connectionString) }),
});

const commit = process.argv.includes("--yes");

/** What a `photos` column holds, as far as this script needs to care. */
type Photo = { url: string; altKa?: string; altEn?: string };

function parse(value: unknown): Photo[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Photo =>
      typeof entry === "object" && entry !== null && typeof (entry as Photo).url === "string",
  );
}

async function main() {
  const rows = await prisma.productImage.findMany({
    select: { id: true, filename: true, contentType: true, bytes: true },
    orderBy: { id: "asc" },
  });

  const held = rows.reduce((sum, row) => sum + row.bytes, 0);
  console.log(`${rows.length} photograph(s) in the database, ${(held / 1e6).toFixed(1)} MB.`);
  if (rows.length === 0) return;

  if (!commit) {
    console.log("\nThis was a dry run. Run it again with --yes to move them.");
    return;
  }

  let moved = 0;
  let orphaned = 0;
  let failed = 0;
  let freed = 0;

  for (const row of rows) {
    const from = `/api/images/${row.id}`;

    // Who points at it. Read before anything is written, so a product that
    // acquires it mid-run is simply left for the next run.
    const users = await prisma.product.findMany({
      where: { OR: [{ image: from }, { photos: { array_contains: [{ url: from }] } }] },
      select: { id: true, image: true, photos: true },
    });

    if (users.length === 0) {
      // Nobody wants it. That is what `forgetUnusedImages` is for, but a row
      // left behind by an older version of it is swept up here too.
      await prisma.productImage.delete({ where: { id: row.id } });
      orphaned++;
      freed += row.bytes;
      continue;
    }

    const full = await prisma.productImage.findUnique({
      where: { id: row.id },
      select: { data: true },
    });
    if (!full) continue;

    let url: string;
    try {
      const name = (row.filename || `${row.id}`).replace(/[^\w.-]+/g, "-").slice(0, 80);
      ({ url } = await put(`products/${name}`, Buffer.from(full.data), {
        access: "public",
        contentType: row.contentType,
        addRandomSuffix: true,
        cacheControlMaxAge: 31_536_000,
      }));
    } catch (error) {
      console.error(`  ${row.id}: could not be put in the store —`, error);
      failed++;
      continue;
    }

    /* Every product that referred to the row, pointed at the blob instead,
       in one transaction with the row's deletion. Either a photograph has
       moved completely or it has not moved at all. */
    await prisma.$transaction([
      ...users.map((product) =>
        prisma.product.update({
          where: { id: product.id },
          data: {
            image: product.image === from ? url : product.image,
            photos: parse(product.photos).map((photo) =>
              photo.url === from ? { ...photo, url } : photo,
            ),
          },
        }),
      ),
      prisma.productImage.delete({ where: { id: row.id } }),
    ]);

    moved++;
    freed += row.bytes;
    if (moved % 25 === 0) console.log(`  …${moved} moved`);
  }

  console.log(
    `\n✓ ${moved} moved to the store, ${orphaned} unused row(s) dropped, ${failed} refused.`,
  );
  console.log(`  ${(freed / 1e6).toFixed(1)} MB no longer in the database.`);

  const left = await prisma.productImage.count();
  console.log(`  ${left} photograph(s) still in Postgres.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
