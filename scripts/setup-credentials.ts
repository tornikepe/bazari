/**
 * Creates the three accounts' credentials in `.env`.
 *
 *     npm run setup:credentials
 *
 * The shop seeds three accounts — an admin, a read-only viewer, and a demo
 * shopper — and refuses to seed at all until each has a password. That refusal
 * is deliberate: a default password in a repository is a default password in
 * production. But it left the first five minutes of the project as a chore of
 * inventing three passwords by hand, which people solve with "admin1234".
 *
 * So this generates them. Each is 24 random characters from a 64-symbol
 * alphabet — about 143 bits, which is not a number anyone needs to think about
 * again.
 *
 * ## What it will not do
 *
 * It does not print the passwords, and it does not overwrite one that is
 * already set.
 *
 * Not printing them is the safer default and costs nothing: they are in `.env`,
 * which is the only place anything reads them from. A password echoed into a
 * terminal lives in that scrollback, in the shell history of whoever scrolled
 * up, and in any screen recording of the session. `--show` is there for the
 * case where you genuinely need to read one out, and it asks for it explicitly.
 *
 * Not overwriting matters more than it looks: rotating `ADMIN_PASSWORD` without
 * re-seeding leaves `.env` and the database disagreeing, and the symptom is
 * being unable to sign in as your own admin. `--force` does it anyway, and says
 * what to run next.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".env");
const TEMPLATE_PATH = resolve(process.cwd(), ".env.example");

/** Matches the seed's own refusal thresholds — see `prisma/seed.ts`. */
const ACCOUNTS = [
  {
    role: "admin",
    emailKey: "ADMIN_EMAIL",
    passwordKey: "ADMIN_PASSWORD",
    defaultEmail: "admin@bazari.ge",
    minimum: 12,
    note: "full dashboard access — can change anything",
  },
  {
    role: "viewer",
    emailKey: "VIEWER_EMAIL",
    passwordKey: "VIEWER_PASSWORD",
    defaultEmail: "viewer@bazari.ge",
    minimum: 12,
    // Held to the admin's minimum on purpose: it cannot write, but it can read
    // every order, address and margin in the shop.
    note: "read-only staff — sees everything, changes nothing",
  },
  {
    role: "customer",
    emailKey: "CUSTOMER_EMAIL",
    passwordKey: "CUSTOMER_PASSWORD",
    defaultEmail: "user@bazari.ge",
    minimum: 8,
    note: "demo shopper — so checkout can be tried without signing up",
  },
] as const;

/**
 * Not an account, but the same chore with the same failure mode.
 *
 * `AUTH_SECRET` signs the session cookie. It was the fourth thing the setup
 * instructions asked you to generate by hand, and leaving it out would mean
 * "run the generator, then also do this one manually" — which is how it ends up
 * being skipped, and an unset signing key is a worse outcome than a weak
 * password.
 */
const SECRETS = [
  // 32 bytes rather than the 18 used for passwords. A password is typed by a
  // person and rate-limited on the way in; a signing key is attacked offline,
  // with no such ceiling, so it gets a full 256 bits.
  { key: "AUTH_SECRET", bytes: 32, note: "signs the session cookie" },
] as const;

const show = process.argv.includes("--show");
const force = process.argv.includes("--force");

/**
 * 24 characters of `base64url`, whose alphabet is `A-Za-z0-9_-`.
 *
 * That alphabet is the point as much as the length: every character survives
 * being pasted into a `.env` value, a shell, a URL and a YAML file without
 * quoting or escaping, so nobody ever has to wonder whether a `$` or a `"` in
 * their password is what broke the deploy.
 */
function generate(bytes = 18): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Sets one key, preserving everything else in the file byte for byte.
 *
 * Line-rewriting rather than parse-and-reserialise, because `.env` here is a
 * documented file: it carries the comments explaining what each key is for, and
 * a round trip through a parser would return the values and throw the prose
 * away.
 *
 * Appends the key if it is absent, so a hand-trimmed `.env` still ends up
 * complete.
 */
function setKey(contents: string, key: string, value: string): string {
  const line = `${key}="${value}"`;
  const pattern = new RegExp(`^(\\s*)${key}\\s*=.*$`, "m");

  if (pattern.test(contents)) {
    return contents.replace(pattern, `$1${line}`);
  }
  return `${contents.replace(/\n*$/, "")}\n${line}\n`;
}

/**
 * Values that are present but are not secrets.
 *
 * `.env.example` used to ship `AUTH_SECRET="dev-only-change-me-to-a-long-random-string"`,
 * so every `.env` copied from it had a signing key that was set, was never
 * questioned, and is readable by anyone who opens the repository. The template
 * no longer does that, but the copies already made still exist — including in
 * deployments — so a placeholder is treated as absent and replaced.
 */
const PLACEHOLDERS = new Set([
  "dev-only-change-me-to-a-long-random-string",
  "change-me",
  "changeme",
  "secret",
  "password",
]);

/** Reads a key's current value, tolerating quotes and stray whitespace. */
function readKey(contents: string, key: string): string {
  const found = contents.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`, "m"));
  if (!found) return "";

  const value = (found[1] ?? "").trim().replace(/^["']|["']$/g, "").trim();
  return PLACEHOLDERS.has(value.toLowerCase()) ? "" : value;
}

function main() {
  if (!existsSync(ENV_PATH)) {
    if (!existsSync(TEMPLATE_PATH)) {
      console.error("Neither .env nor .env.example exists — run this from the project root.");
      process.exit(1);
    }
    copyFileSync(TEMPLATE_PATH, ENV_PATH);
    console.log("Created .env from .env.example\n");
  }

  let contents = readFileSync(ENV_PATH, "utf8");
  const generated: string[] = [];
  const kept: string[] = [];
  const short: string[] = [];
  const revealed: string[] = [];

  for (const account of ACCOUNTS) {
    // The address is not a secret and having one already set is the common
    // case, so it is only ever filled in, never replaced.
    if (!readKey(contents, account.emailKey)) {
      contents = setKey(contents, account.emailKey, account.defaultEmail);
    }
    const email = readKey(contents, account.emailKey);
    const existing = readKey(contents, account.passwordKey);

    if (existing && !force) {
      kept.push(`  ${account.role.padEnd(9)} ${email}`);
      // A password that is set but too short still fails at seed time, so say
      // so now rather than letting `db:seed` be the one to explain it.
      if (existing.length < account.minimum) {
        short.push(
          `  ${account.passwordKey} is ${existing.length} characters; the seed requires ${account.minimum}`,
        );
      }
      continue;
    }

    const password = generate();
    contents = setKey(contents, account.passwordKey, password);
    generated.push(`  ${account.role.padEnd(9)} ${email}\n${" ".repeat(11)}└ ${account.note}`);
    if (show) revealed.push(`  ${account.role.padEnd(9)} ${email}  ${password}`);
  }

  for (const secret of SECRETS) {
    const existing = readKey(contents, secret.key);
    if (existing && !force) {
      kept.push(`  ${secret.key.padEnd(9)} (${secret.note})`);
      continue;
    }
    contents = setKey(contents, secret.key, generate(secret.bytes));
    generated.push(`  ${secret.key.padEnd(9)}\n${" ".repeat(11)}└ ${secret.note}`);
  }

  writeFileSync(ENV_PATH, contents);

  if (generated.length) {
    console.log(`Generated ${generated.length} value(s), written to .env:`);
    console.log(generated.join("\n"));
    console.log();
  }

  if (kept.length) {
    console.log("Left alone, already set:");
    console.log(kept.join("\n"));
    console.log();
  }

  if (short.length) {
    console.log("Too short to seed with:");
    console.log(short.join("\n"));
    console.log("  Re-run with --force to replace them.\n");
  }

  if (revealed.length) {
    console.log("Passwords (--show):");
    console.log(revealed.join("\n"));
    console.log();
  } else if (generated.length) {
    console.log("The passwords are in .env. Re-run with --show to print them.\n");
  }

  if (generated.length) {
    console.log("These are what `npm run db:seed` will create the accounts with.");
    console.log("If the accounts already exist, re-seed so the database matches:\n");
    console.log("    npm run db:seed\n");
  }
}

main();
