/**
 * Puts a backup back — into an *empty* database on the *same* schema.
 *
 *     npx prisma migrate deploy                 # the schema first, always
 *     npm run db:restore -- backups/bazari-2026-09-13T10-15.json
 *
 * It refuses two things. A database whose applied migrations differ from
 * the backup's — a row from last month does not fit a table from this one,
 * and guessing is how a restore corrupts what it was meant to save. And,
 * without `--replace`, a database that already holds rows: the one place
 * this must never run by accident is production, and "empty" is the one
 * state a typo cannot be aimed at.
 *
 * Tables are loaded parents first, in an order worked out from the foreign
 * keys the database declares, inside one transaction — either every row
 * lands or none does.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import type { Backup } from "./backup-database";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — copy .env.example to .env");
  process.exit(1);
}

const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
const replace = process.argv.includes("--replace");
if (!file) {
  console.error("usage: npm run db:restore -- <backup.json> [--replace]");
  process.exit(1);
}

/** Tables ordered so that every table comes after the ones it points at. */
function dependencyOrder(tables: string[], edges: { from: string; to: string }[]): string[] {
  const remaining = new Set(tables);
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter(
      (table) => !edges.some((edge) => edge.from === table && edge.to !== table && remaining.has(edge.to)),
    );
    if (ready.length === 0) throw new Error(`circular foreign keys among: ${[...remaining].join(", ")}`);
    for (const table of ready.sort()) {
      ordered.push(table);
      remaining.delete(table);
    }
  }
  return ordered;
}

function revive(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const wrapped = value as Record<string, unknown>;
    if ("$bytes" in wrapped) return Buffer.from(String(wrapped.$bytes), "base64");
    if ("$date" in wrapped) return new Date(String(wrapped.$date));
    if ("$json" in wrapped) return JSON.stringify(wrapped.$json);
  }
  return value;
}

async function main() {
  const backup = JSON.parse(readFileSync(file!, "utf8")) as Backup;
  if (backup.format !== 1) throw new Error(`unknown backup format ${String(backup.format)}`);

  const client = new Client({ connectionString });
  await client.connect();

  // The same schema, exactly: not a subset, not a newer one.
  const applied = (
    await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`,
    )
  ).rows.map((row) => row.migration_name);
  const missing = backup.migrations.filter((name) => !applied.includes(name));
  const extra = applied.filter((name) => !backup.migrations.includes(name));
  if (missing.length > 0 || extra.length > 0) {
    console.error("✗ the database is not on the backup's schema.");
    if (missing.length > 0) console.error(`  not applied here: ${missing.join(", ")}`);
    if (extra.length > 0) console.error(`  applied here but not in the backup: ${extra.join(", ")}`);
    console.error("  run `npx prisma migrate deploy` against a fresh database, then restore.");
    process.exit(1);
  }

  const tables = Object.keys(backup.tables);

  /* Empty, or told to replace. "Empty" means no shop in it — no people, no
     products, no orders. A settings row or an information page put there by
     a migration is furniture, not data, and a freshly migrated database has
     some; the load below empties every table regardless. */
  let held = 0;
  for (const table of ["User", "Product", "Order"]) {
    const { rows } = await client.query<{ n: string }>(`SELECT count(*)::text AS n FROM "${table}"`);
    held += Number(rows[0]!.n);
  }
  if (held > 0 && !replace) {
    console.error(`✗ the database already holds a shop (${held} users, products and orders). Pass --replace to overwrite it — and be sure.`);
    process.exit(1);
  }

  const edges = (
    await client.query<{ from: string; to: string }>(
      `SELECT tc.table_name AS "from", ccu.table_name AS "to"
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`,
    )
  ).rows;
  const order = dependencyOrder(tables, edges);

  await client.query("BEGIN");
  try {
    await client.query(`TRUNCATE ${tables.map((table) => `"${table}"`).join(", ")} CASCADE`);

    let total = 0;
    for (const table of order) {
      const { columns, rows } = backup.tables[table]!;
      if (rows.length === 0) continue;
      const names = columns.map((column) => `"${column}"`).join(", ");

      // Five hundred rows a statement: one round trip per batch, and a
      // parameter count Postgres is happy with.
      for (let start = 0; start < rows.length; start += 500) {
        const batch = rows.slice(start, start + 500);
        const params: unknown[] = [];
        const tuples = batch.map(
          (row) => `(${row.map((value) => { params.push(revive(value)); return `$${params.length}`; }).join(", ")})`,
        );
        await client.query(`INSERT INTO "${table}" (${names}) VALUES ${tuples.join(", ")}`, params);
      }
      total += rows.length;
      console.log(`  ${table.padEnd(20)} ${String(rows.length).padStart(6)} rows`);
    }

    await client.query("COMMIT");
    console.log(`\n✓ ${total} rows restored from ${backup.takenAt}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("✗ restore failed:", error);
  process.exit(1);
});
