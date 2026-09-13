/**
 * Every row of every table, into one file.
 *
 *     npm run db:backup                     # backups/bazari-2026-09-13T10-15.json
 *     npm run db:backup -- --out /tmp/x.json
 *
 * Written with `pg` and a query per table rather than `pg_dump`, because the
 * machine this runs on may have no Postgres installed at all — this one does
 * not — and because a file that is JSON can be read, diffed and restored by
 * the script beside this one without matching server versions. It is a
 * logical copy: rows, not pages. Bytes (the uploaded photos) go in as base64.
 *
 * The file records which migrations the database had applied, so a restore
 * into a database on a different schema refuses rather than guesses.
 *
 * What it is for: the moment before a migration, a move to another Postgres,
 * and the one restore that proves a backup was worth taking. What it is not:
 * a substitute for the provider's own point-in-time recovery, which catches
 * the hour between two of these.
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — copy .env.example to .env");
  process.exit(1);
}

const outArg = process.argv.indexOf("--out");
const stamp = new Date().toISOString().slice(0, 16).replace(":", "-");
const outPath = outArg > -1 ? process.argv[outArg + 1]! : join("backups", `bazari-${stamp}.json`);

export type Backup = {
  format: 1;
  takenAt: string;
  migrations: string[];
  tables: Record<string, { columns: string[]; rows: unknown[][] }>;
};

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  // A consistent snapshot: every table read inside one repeatable-read
  // transaction, so an order and its lines come from the same instant.
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

  const migrations = (
    await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`,
    )
  ).rows.map((row) => row.migration_name);

  const tables = (
    await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
        ORDER BY table_name`,
    )
  ).rows.map((row) => row.table_name);

  const backup: Backup = { format: 1, takenAt: new Date().toISOString(), migrations, tables: {} };
  let total = 0;

  for (const table of tables) {
    // Generated columns are the database's to fill; a restore must not send
    // them back. Everything else goes, in declared order.
    const columns = (
      await client.query<{ column_name: string; is_generated: string; data_type: string }>(
        `SELECT column_name, is_generated, data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [table],
      )
    ).rows.filter((column) => column.is_generated === "NEVER");

    const names = columns.map((column) => `"${column.column_name}"`).join(", ");
    const result = await client.query({ text: `SELECT ${names} FROM "${table}"`, rowMode: "array" });

    const rows = result.rows.map((row: unknown[]) =>
      row.map((value, index) => {
        if (Buffer.isBuffer(value)) return { $bytes: value.toString("base64") };
        if (value instanceof Date) return { $date: value.toISOString() };
        // A bigint or a numeric arrives as a string from pg and goes back as one.
        if (columns[index]!.data_type === "jsonb" || columns[index]!.data_type === "json") return { $json: value };
        return value;
      }),
    );

    backup.tables[table] = { columns: columns.map((column) => column.column_name), rows };
    total += rows.length;
    console.log(`  ${table.padEnd(20)} ${String(rows.length).padStart(6)} rows`);
  }

  await client.query("COMMIT");
  await client.end();

  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(backup));
  const kb = Math.round(Buffer.byteLength(JSON.stringify(backup)) / 1024);
  console.log(`\n✓ ${total} rows from ${tables.length} tables, ${migrations.length} migrations → ${outPath} (${kb} KB)`);
}

main().catch((error) => {
  console.error("✗ backup failed:", error);
  process.exit(1);
});
