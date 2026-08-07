import type { Page } from "@playwright/test";

/**
 * The seeded accounts.
 *
 * All three read from the same environment the seed writes from, so the tests
 * cannot drift from the database the way a hardcoded literal does.
 */
export const DEMO_CUSTOMER = {
  email: process.env.CUSTOMER_EMAIL ?? "user@bazari.ge",
  password: process.env.CUSTOMER_PASSWORD ?? "",
};
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "admin@bazari.ge",
  password: process.env.ADMIN_PASSWORD ?? "",
};
/** Read-only staff. Same source of truth as the admin — the seed reads these. */
export const VIEWER = {
  email: process.env.VIEWER_EMAIL ?? "viewer@bazari.ge",
  password: process.env.VIEWER_PASSWORD ?? "",
};

/** A unique address per run, so re-runs never collide on the unique email. */
export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

/**
 * Fills the sign-in form and submits it, without assuming it works.
 *
 * For tests about *failing* to sign in — those stay on /login by design, so
 * they cannot use the version below.
 */
export async function submitSignIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email|ელფოსტა/i).first().fill(email);
  await page.getByLabel(/password|პაროლი/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|შესვლა/i }).click();
}

/**
 * Signs in, and waits for the session to actually exist.
 *
 * The wait is the important part. `login` is a Server Action ending in a
 * `redirect`, so the session cookie only exists once that response lands;
 * navigating straight afterwards races it and arrives back at /login with no
 * session, which reads exactly like a permissions bug.
 */
export async function signIn(page: Page, email: string, password: string) {
  await submitSignIn(page, email, password);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
}

/**
 * Puts one product in the cart without clicking through the catalogue.
 *
 * The cart lives in localStorage, so seeding it directly keeps checkout tests
 * about checkout rather than about the add-to-cart button, which has its own
 * test.
 */
export async function seedCart(page: Page, quantity = 1) {
  await page.goto("/");
  const product = await page.evaluate(async () => {
    const res = await fetch("/catalog", { headers: { Accept: "text/html" } });
    const html = await res.text();
    return html.match(/\/product\/([a-z0-9-]+)/)?.[1] ?? null;
  });
  if (!product) throw new Error("no product found in the catalogue");

  await page.goto(`/product/${product}`);
  const addButton = page.getByRole("button", { name: /add to cart|კალათაში/i }).first();
  for (let i = 0; i < quantity; i++) await addButton.click();

  return product;
}

/** English keeps the selectors readable regardless of the default locale. */
export async function useEnglish(page: Page) {
  await page.context().addCookies([
    { name: "cm_locale", value: "en", url: "http://127.0.0.1:3100" },
  ]);
}

/**
 * Reads a column straight from the database.
 *
 * For assertions about whether a write *happened*, as opposed to whether the
 * UI claims it did. Parsing it back out of rendered HTML means depending on
 * attribute order and on the very rendering the test is meant to be checking.
 */
export async function readProductFlag(id: string, column: "isActive"): Promise<boolean | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("[e2e] DATABASE_URL is not set");

  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(`SELECT "${column}" FROM "Product" WHERE id = $1`, [id]);
    return result.rows[0]?.[column] ?? null;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * How many opening `pending` events an order carries.
 *
 * Read from the database rather than from the timeline on the page: the page
 * faithfully renders duplicates, so counting what it shows would pass on the
 * exact bug this is here to catch.
 */
export async function countPendingEvents(orderNumber: string): Promise<number> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("[e2e] DATABASE_URL is not set");

  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM "OrderEvent" e
         JOIN "Order" o ON o.id = e."orderId"
        WHERE o.number = $1 AND e.status = 'pending'`,
      [orderNumber],
    );
    return result.rows[0]?.n ?? 0;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Clears the rate-limit counters mid-run.
 *
 * `global-setup.ts` clears them once before the suite, which is enough for
 * most tests. It is not enough for the ones that deliberately hammer the
 * reset endpoint: the limit is 10 requests an hour per address, and a single
 * full run makes more than that between them. The result was a security test
 * failing with "Too many attempts" and looking exactly like an enumeration
 * leak — the worst kind of false alarm, because the honest reading of a red
 * security test is to believe it.
 *
 * Uses `pg` rather than the Prisma client for the same reason global-setup
 * does: the generated client is ESM and this file is loaded as CommonJS.
 */
export async function clearRateLimits() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("[e2e] DATABASE_URL is not set — rate limits NOT cleared");
    return;
  }

  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query('DELETE FROM "RateLimit"');
  } catch {
    // Housekeeping must never fail a test on its own.
  } finally {
    await client.end().catch(() => {});
  }
}
