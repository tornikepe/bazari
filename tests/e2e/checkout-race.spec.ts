import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, signIn, useEnglish } from "./helpers";

/**
 * Six shoppers, three units, one moment.
 *
 * The one promise a shop cannot break is that it does not sell what it does
 * not have. `placeOrder` keeps it with a conditional decrement — the `gte`
 * guard is evaluated by the database as part of the write — and this is the
 * test that makes it earn that sentence: six checkouts fired in the same
 * instant at a product with three left, of which exactly three may succeed
 * and the shelf must end at zero, never below it.
 *
 * A load test in the only sense that matters for a checkout: not "how many
 * per second" but "what happens when they all arrive at once".
 */

test.skip(!ADMIN.password || !DEMO_CUSTOMER.password, "the seeded passwords are not set");

const SHOPPERS = 6;
const UNITS = 3;

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("[e2e] DATABASE_URL is not set");
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end().catch(() => {});
  }
}

/** Sets a product's stock from the table, so the ledger says why. */
async function setStock(page: Page, name: string, value: number) {
  // Searched for by name rather than scrolled to: the table is paginated.
  await page.goto(`/dashboard/products?status=active&q=${encodeURIComponent(name)}`);
  const row = page.locator("main table tbody tr").filter({ hasText: name }).first();
  await row.getByRole("button", { name: new RegExp(`change the stock of ${name}`, "i") }).click();
  const field = row.getByRole("spinbutton", { name: /change the stock/i });
  await field.fill(String(value));
  await field.press("Enter");
  await expect(
    row.getByRole("button", { name: new RegExp(`change the stock of ${name}`, "i") }),
  ).toHaveText(new RegExp(`^\\D*${value}\\D*$`));
}

/** A signed-in shopper with the product in their cart, waiting at the button. */
async function shopper(browser: Browser, slug: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  // What `useEnglish` does, written out: the lint's hook rule reads that
  // helper's name as a React hook and this function's as neither.
  await context.addCookies([{ name: "cm_locale", value: "en", url: "http://127.0.0.1:3100" }]);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await page.goto(`/product/${slug}`);
  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await page.goto("/checkout");
  await page.getByLabel(/full name/i).fill("Race Buyer");
  await page.getByLabel(/phone/i).fill("555000444");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 4");
  return page;
}

test("the last three units go to exactly three of six simultaneous buyers", async ({
  browser,
  page,
}) => {
  test.slow();

  // Six orders from one address in a minute is what the checkout throttle is
  // for; here it would fail the test for being the test.
  await query(`DELETE FROM "RateLimit" WHERE "key" LIKE 'order:%'`);

  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  // A product with no variants — the race is on the product's own figure.
  const [product] = await query<{ id: string; slug: string; nameEn: string; stock: number }>(
    `SELECT p.id, p.slug, p."nameEn", p.stock FROM "Product" p
     WHERE p."isActive" AND NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v."productId" = p.id)
     ORDER BY p.stock DESC LIMIT 1`,
  );
  expect(product, "no plain product to race for").toBeTruthy();
  const original = product!.stock;

  await setStock(page, product!.nameEn, UNITS);

  const pages: Page[] = [];
  try {
    for (let i = 0; i < SHOPPERS; i++) pages.push(await shopper(browser, product!.slug));

    // All at once: the clicks are issued without awaiting one another.
    const outcomes = await Promise.all(
      pages.map(async (buyer) => {
        await buyer.getByRole("button", { name: /place order/i }).click();
        await Promise.race([
          buyer.waitForURL(/\/order\/BZ-/, { timeout: 30_000 }),
          buyer.getByText(/no longer for sale/i).waitFor({ timeout: 30_000 }),
        ]);
        return /\/order\/BZ-/.test(buyer.url()) ? "bought" : "refused";
      }),
    );

    const bought = outcomes.filter((outcome) => outcome === "bought").length;
    expect(bought, `outcomes: ${outcomes.join(", ")}`).toBe(UNITS);

    const [after] = await query<{ stock: number }>(`SELECT stock FROM "Product" WHERE id = $1`, [
      product!.id,
    ]);
    expect(after!.stock).toBe(0);
  } finally {
    for (const buyer of pages) await buyer.context().close();
    // Back to what it was, through the table, so the ledger shows the round trip.
    await setStock(page, product!.nameEn, original);
  }
});
