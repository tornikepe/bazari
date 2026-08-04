import type { Page } from "@playwright/test";

/** Seeded accounts. The admin password comes from the environment. */
export const DEMO_CUSTOMER = { email: "user@bazari.ge", password: "user1234" };
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "admin@bazari.ge",
  password: process.env.ADMIN_PASSWORD ?? "",
};

/** A unique address per run, so re-runs never collide on the unique email. */
export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email|ელფოსტა/i).first().fill(email);
  await page.getByLabel(/password|პაროლი/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|შესვლა/i }).click();
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
