/**
 * Checks that a database is complete enough to serve the site.
 *
 * Written for one moment in particular: pointing the app at a new Postgres and
 * wanting to know, before sending anybody to it, that the move worked. A
 * migration can apply cleanly and still leave a database the site cannot use —
 * the settings row missing, no information pages, no admin to sign in as — and
 * every one of those failures first shows up as a page that half-renders.
 *
 * Run after `prisma migrate deploy` and `prisma db seed`:
 *
 *     npm run db:verify
 *
 * Exits non-zero on the first thing that is missing, naming it.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { INFO_SLUGS } from "../src/lib/info-pages";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — copy .env.example to .env");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type Check = { label: string; run: () => Promise<string | null> };

/** Each returns null when satisfied, or a sentence saying what is wrong. */
const checks: Check[] = [
  {
    label: "connection",
    run: async () => {
      await prisma.$queryRaw`SELECT 1`;
      return null;
    },
  },
  {
    label: "migrations applied",
    run: async () => {
      // The tables the newest migrations add. If these are missing the schema
      // is behind, whatever `_prisma_migrations` claims.
      await prisma.shopSettings.findFirst();
      await prisma.infoPage.findFirst();
      return null;
    },
  },
  {
    label: "shop settings row",
    run: async () => {
      const row = await prisma.shopSettings.findUnique({ where: { id: "shop" } });
      if (!row) return "no settings row — the site falls back to defaults and nothing is editable";
      if (!row.name.trim()) return "the shop has no name";
      return null;
    },
  },
  {
    label: "information pages",
    run: async () => {
      const rows = await prisma.infoPage.findMany({ select: { slug: true } });
      const present = new Set(rows.map((row) => row.slug));
      const missing = INFO_SLUGS.filter((slug) => !present.has(slug));
      return missing.length ? `missing pages: ${missing.join(", ")}` : null;
    },
  },
  {
    label: "catalogue",
    run: async () => {
      const [categories, products] = await Promise.all([
        prisma.category.count(),
        prisma.product.count({ where: { isActive: true } }),
      ]);
      if (categories === 0) return "no categories";
      if (products === 0) return "no active products — the catalogue renders empty";
      return null;
    },
  },
  {
    label: "staff and demo accounts",
    run: async () => {
      const [admins, viewers, customers] = await Promise.all([
        prisma.user.count({ where: { role: "admin" } }),
        prisma.user.count({ where: { role: "viewer" } }),
        prisma.user.count({ where: { role: "customer" } }),
      ]);
      if (admins === 0) return "no admin — nobody can reach the dashboard";
      if (viewers === 0) return "no viewer account";
      if (customers === 0) return "no customer account";
      return null;
    },
  },
  {
    label: "money is stored as integers",
    run: async () => {
      // Prices are whole tetri by construction. A fractional one means the
      // data arrived from somewhere that did not know that — worth catching
      // at the moment of a move rather than at a checkout.
      const rows = await prisma.$queryRaw<{ n: bigint }[]>`
        SELECT count(*)::bigint AS n FROM "Product" WHERE price <> floor(price)
      `;
      const bad = Number(rows[0]?.n ?? 0);
      return bad > 0 ? `${bad} products have a fractional price` : null;
    },
  },
];

async function main() {
  let failed = 0;

  for (const check of checks) {
    try {
      const problem = await check.run();
      if (problem) {
        console.error(`  ✗ ${check.label} — ${problem}`);
        failed++;
      } else {
        console.log(`  ✓ ${check.label}`);
      }
    } catch (error) {
      console.error(`  ✗ ${check.label} — ${(error as Error).message.split("\n")[0]}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed. Run: npm run db:setup`);
    process.exit(1);
  }

  console.log("\nDatabase is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
