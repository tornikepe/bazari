/**
 * Runs the end-to-end suite against a database that deletes itself.
 *
 * The suite writes to whatever `DATABASE_URL` points at: it places orders,
 * sells stock down, invites staff, changes the settings and puts them back.
 * That is fine against a database made for it and alarming against the one
 * the shop is running on. This makes the first kind, from nothing:
 *
 *     npm run test:e2e:scratch                 # the whole suite
 *     npm run test:e2e:scratch -- --project=firefox tests/e2e/returns.spec.ts
 *
 * Everything after `--` is handed to Playwright unchanged.
 *
 * What it does, in order: asks Prisma's `create-db` for a temporary Postgres
 * (no account, gone in two hours), applies every migration to it, seeds it
 * from the same `.env` the app uses — the three passwords come from there —
 * and starts Playwright with `DATABASE_URL` and `DIRECT_URL` pointing at it.
 * The child processes still load `.env` themselves, and `dotenv` never
 * overrides a variable that is already set, so those two are the only ones
 * that differ. Nothing about the database is written anywhere; when the
 * process ends there is nothing to clean up.
 *
 * Kept as a script rather than folded into Playwright's `globalSetup`, which
 * runs *after* the web server has been started with the environment it was
 * started with — too late to hand it a different database.
 */
import { spawnSync } from "node:child_process";

const TTL = "2h";

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  label: string,
  attempts = 1,
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`\n→ ${label}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);
    const result = spawnSync(command, args, {
      stdio: "inherit",
      env,
      shell: process.platform === "win32",
    });
    if (result.status === 0) return;
    if (attempt < attempts) {
      // A database that was created a second ago is sometimes not yet
      // taking connections; the second try lands.
      spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 4000)"]);
      continue;
    }
    console.error(`\n✗ ${label} failed (exit ${result.status ?? "signal"})`);
    process.exit(result.status ?? 1);
  }
}

console.log(`→ creating a throwaway Postgres (deleted after ${TTL})`);
const created = spawnSync(
  "npx",
  ["--yes", "create-db@latest", "create", "--ttl", TTL, "--json"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
if (created.status !== 0) {
  console.error(created.stderr || created.stdout);
  console.error("✗ create-db failed — it needs the network, and nothing else");
  process.exit(created.status ?? 1);
}

let connectionString: string;
let deletionDate = "";
try {
  // The CLI prints a line or two of its own before the JSON on some
  // versions; the object is the part that matters.
  const json = created.stdout.slice(created.stdout.indexOf("{"));
  const parsed = JSON.parse(json) as { connectionString?: string; deletionDate?: string };
  if (!parsed.connectionString) throw new Error("no connectionString in the answer");
  connectionString = parsed.connectionString;
  deletionDate = parsed.deletionDate ?? "";
} catch (error) {
  console.error("✗ could not read create-db's answer:", (error as Error).message);
  console.error(created.stdout);
  process.exit(1);
}

const host = new URL(connectionString).host;
console.log(`  ${host}${deletionDate ? ` — gone at ${deletionDate}` : ""}`);

// The two URLs the app distinguishes, both the same here: a throwaway has no
// pooler, and the migration must not go through one anyway.
const env = { ...process.env, DATABASE_URL: connectionString, DIRECT_URL: connectionString };

run("npx", ["prisma", "migrate", "deploy"], env, "applying the migrations", 3);
run("npx", ["prisma", "db", "seed"], env, "seeding");
run("npx", ["playwright", "test", ...process.argv.slice(2)], env, "running the suite");

console.log(`\n✓ done — the database at ${host} deletes itself${deletionDate ? ` at ${deletionDate}` : ""}`);
