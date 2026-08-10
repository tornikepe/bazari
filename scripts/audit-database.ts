/**
 * Audits the data itself, where `db:verify` audits the shape.
 *
 * `db:verify` answers "is there enough here to serve the site" — a settings
 * row, some products, an admin to sign in as. This answers a different
 * question: "is any of it wrong". The two failure modes are different enough
 * to deserve separate commands. A missing table takes the site down on the
 * next request and you find out immediately; a subtotal that no longer matches
 * its items renders perfectly, forever, and is found by a customer.
 *
 * Written when moving the database to another host, and kept because the same
 * checks apply to any bulk import — dropping a real catalogue into this site is
 * the point of it, and a spreadsheet full of prices is exactly where whole-tetri
 * arithmetic and Georgian text go wrong.
 *
 *     npm run db:audit
 *
 * Exits non-zero listing everything that is wrong, rather than stopping at the
 * first: when data is damaged you want the extent of it, not one example.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Audited over the direct endpoint. A pooler is fine for this, but the point of
// the exercise is to read what is actually stored.
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — copy .env.example to .env");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

let failed = 0;

/**
 * Every check counts rows that should not exist. Zero is health, and the count
 * itself is the useful part of a failure — one bad order is a stray edit, four
 * hundred is a bad import.
 */
async function expectNone(label: string, sql: string, noun: string, ...params: unknown[]) {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(sql, ...params);
  const n = Number(rows[0]?.n ?? 0);
  if (n === 0) {
    console.log(`  ok    ${label}`);
  } else {
    console.log(`  BAD   ${label} — ${n} ${noun}`);
    failed++;
  }
}

async function count(sql: string) {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(sql);
  return Number(rows[0]?.n ?? 0);
}

async function main() {
  // Foreign keys make most of these impossible — unless the rows arrived by a
  // route that had them switched off, which is precisely what a bulk load or a
  // host-to-host copy does.
  console.log("referential integrity");
  await expectNone(
    "no order items without an order",
    `SELECT count(*)::bigint n FROM "OrderItem" i LEFT JOIN "Order" o ON o.id = i."orderId" WHERE o.id IS NULL`,
    "orphans",
  );
  await expectNone(
    "no order events without an order",
    `SELECT count(*)::bigint n FROM "OrderEvent" e LEFT JOIN "Order" o ON o.id = e."orderId" WHERE o.id IS NULL`,
    "orphans",
  );
  await expectNone(
    "no stock movements without a product",
    `SELECT count(*)::bigint n FROM "StockMovement" m LEFT JOIN "Product" p ON p.id = m."productId" WHERE p.id IS NULL`,
    "orphans",
  );
  await expectNone(
    "no products in a missing category",
    `SELECT count(*)::bigint n FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId" WHERE c.id IS NULL`,
    "orphans",
  );
  await expectNone(
    "no orders pointing at a missing user",
    `SELECT count(*)::bigint n FROM "Order" o WHERE o."userId" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = o."userId")`,
    "dangling references",
  );

  const fks = await count(`SELECT count(*)::bigint n FROM pg_constraint WHERE contype = 'f'`);
  console.log(`  ${fks} foreign keys are enforced`);
  if (fks === 0) {
    console.log("  BAD   no foreign keys at all — the copy dropped them");
    failed++;
  }

  console.log("\nevery order is complete");
  await expectNone(
    "each order has at least one item",
    `SELECT count(*)::bigint n FROM "Order" o WHERE NOT EXISTS (SELECT 1 FROM "OrderItem" i WHERE i."orderId" = o.id)`,
    "empty orders",
  );
  await expectNone(
    "each order has at least one event",
    `SELECT count(*)::bigint n FROM "Order" o WHERE NOT EXISTS (SELECT 1 FROM "OrderEvent" e WHERE e."orderId" = o.id)`,
    "orders with no history",
  );
  await expectNone(
    "no duplicate order numbers",
    `SELECT count(*)::bigint n FROM (SELECT number FROM "Order" GROUP BY number HAVING count(*) > 1) d`,
    "duplicated numbers",
  );
  // This one is here because it happened: an order was created with its opening
  // event already nested, and then given a second identical one. The history
  // read as though a human had done something, and nobody had.
  await expectNone(
    "no order has the same status recorded twice in a row",
    `SELECT count(*)::bigint n FROM (
       SELECT lag(e.status) OVER (PARTITION BY e."orderId" ORDER BY e."createdAt", e.id) AS prev, e.status
       FROM "OrderEvent" e
     ) s WHERE prev = status`,
    "repeated events",
  );

  // Money is whole tetri everywhere, and an order stores its parts as well as
  // its total so an old invoice survives a price change. Both facts are only
  // true while nothing has written to these columns that did not know them.
  console.log("\nthe money adds up");
  await expectNone(
    "order totals equal subtotal + shipping − discount",
    `SELECT count(*)::bigint n FROM "Order" WHERE total <> subtotal + shipping - discount`,
    "orders that do not balance",
  );
  await expectNone(
    "order subtotals equal the sum of their items",
    `SELECT count(*)::bigint n FROM (
       SELECT o.id FROM "Order" o JOIN "OrderItem" i ON i."orderId" = o.id
       GROUP BY o.id, o.subtotal HAVING o.subtotal <> sum(i.price * i.quantity)
     ) d`,
    "orders whose items do not sum to the subtotal",
  );
  await expectNone(
    "no negative money",
    `SELECT count(*)::bigint n FROM "Order" WHERE total < 0 OR subtotal < 0 OR shipping < 0 OR discount < 0`,
    "orders with negative money",
  );
  await expectNone(
    "no zero or negative quantities",
    `SELECT count(*)::bigint n FROM "OrderItem" WHERE quantity <= 0`,
    "order items",
  );
  await expectNone(
    "product prices are whole tetri",
    `SELECT count(*)::bigint n FROM "Product" WHERE price <> floor(price) OR price < 0`,
    "products",
  );
  await expectNone(
    "invoiced prices are whole tetri",
    `SELECT count(*)::bigint n FROM "OrderItem" WHERE price <> floor(price) OR price < 0`,
    "order items",
  );

  console.log("\nnothing required is blank");
  await expectNone(
    "every product has both names",
    `SELECT count(*)::bigint n FROM "Product" WHERE btrim("nameKa") = '' OR btrim("nameEn") = ''`,
    "products missing a name",
  );
  await expectNone(
    "every category has both names",
    `SELECT count(*)::bigint n FROM "Category" WHERE btrim("nameKa") = '' OR btrim("nameEn") = ''`,
    "categories missing a name",
  );
  await expectNone(
    "every product has a SKU",
    `SELECT count(*)::bigint n FROM "Product" WHERE btrim(sku) = ''`,
    "products with no SKU",
  );
  await expectNone(
    "every account has a password hash",
    `SELECT count(*)::bigint n FROM "User" WHERE btrim(password) = ''`,
    "accounts with no password",
  );
  await expectNone("no negative stock", `SELECT count(*)::bigint n FROM "Product" WHERE stock < 0`, "products");

  // The site is Georgian first. Text that went through a copy with the wrong
  // client encoding still renders — as gibberish — and no other check notices.
  //
  // The pattern took two corrections, both found by corrupting a real name and
  // watching the check pass anyway. Georgian sits at U+10A0–U+10FF, which UTF-8
  // encodes as E1 82 xx / E1 83 xx — so the first byte always reads back as "á",
  // never as the Ã or Ð a first version looked for; those belong to Western
  // European and Cyrillic text. The second byte depends on which decoder did the
  // damage: cp1252 turns 82 and 83 into "‚" and "ƒ", Latin-1 leaves them as
  // invisible C1 control characters. Both happen, so both are matched — and the
  // C1 range is the strongest signal of the three, because no legitimate text
  // contains it at all.
  //
  // Passed as a parameter rather than interpolated: control characters do not
  // survive being quoted into a statement.
  const MOJIBAKE = "[\u0080-\u009F]|á[‚ƒ]|[ÃÂÐÑ]";
  console.log("\nGeorgian text is intact");
  const encoding = await prisma.$queryRaw<{ e: string }[]>`
    SELECT pg_encoding_to_char(encoding) AS e FROM pg_database WHERE datname = current_database()
  `;
  const enc = encoding[0]?.e ?? "unknown";
  console.log(`  database encoding: ${enc}`);
  if (enc !== "UTF8") {
    console.log("  BAD   not UTF8 — Georgian cannot be stored losslessly");
    failed++;
  }
  await expectNone(
    "no mojibake in product names",
    `SELECT count(*)::bigint n FROM "Product" WHERE "nameKa" ~ $1 OR "nameEn" ~ $1`,
    "products with mangled text",
    MOJIBAKE,
  );
  await expectNone(
    "no mojibake in the information pages",
    `SELECT count(*)::bigint n FROM "InfoPage" WHERE "bodyKa" ~ $1 OR "titleKa" ~ $1`,
    "pages with mangled text",
    MOJIBAKE,
  );
  // Not every product name contains Georgian — a brand written the same way in
  // both languages is normal — but a catalogue with none at all means the text
  // did not survive.
  const georgian = await count(`SELECT count(*)::bigint n FROM "Product" WHERE "nameKa" ~ '[ა-ჰ]'`);
  const products = await count(`SELECT count(*)::bigint n FROM "Product"`);
  console.log(`  ${georgian} of ${products} product names contain Georgian`);
  if (products > 0 && georgian === 0) {
    console.log("  BAD   no Georgian anywhere in the catalogue");
    failed++;
  }

  console.log(
    failed === 0 ? "\nNo damage found." : `\n${failed} problem(s) found. None of these fix themselves.`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
