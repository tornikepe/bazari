import { expect, test } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * What the shelf holds, straight from the database. The product page rounds
 * the figure into "in stock" and "only 3 left", which is right for a shopper
 * and useless for a comparison.
 */
async function stockOf(slug: string): Promise<number> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("[e2e] DATABASE_URL is not set");
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query(`SELECT "stock" FROM "Product" WHERE slug = $1`, [slug]);
    return Number(result.rows[0]?.stock ?? 0);
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * A return, end to end: the shopper asks on the order page, the shop answers
 * from the dashboard, and the shopper sees the answer where they asked.
 *
 * The order is placed and delivered inside the test, because the rule only
 * admits a delivered order inside its window — nothing seeded can be relied
 * on to be one.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

test("a shopper asks, the shop answers, and the stock comes back on receipt", async ({
  page,
}) => {
  // ----- the shopper buys -----
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  const slug = await seedCart(page);
  await page.goto("/checkout");
  await page.getByLabel(/full name/i).fill("E2E Returner");
  await page.getByLabel(/phone/i).fill("555000999");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 9");
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page).toHaveURL(/\/order\/BZ-/);
  const number = page.url().split("/").pop()!;

  // Not yet: nothing has arrived.
  await expect(page.getByRole("button", { name: /request a return/i })).toHaveCount(0);

  // ----- the shop delivers -----
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto(`/dashboard/orders?q=${number}`);
  // The table, not the card list underneath it that only a phone shows.
  await page.locator('main table a[href^="/dashboard/orders/"]', { hasText: number }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\/[a-z0-9]+/);
  const orderUrl = page.url();
  await page.getByLabel(/update status/i).selectOption("delivered");
  await expect(page.locator("main")).toContainText(/delivered/i);

  // What the shelf holds before the return, for the comparison at the end.
  const stockBefore = await stockOf(slug);

  // ----- the shopper asks -----
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await page.goto(`/order/${number}`);
  await page.getByRole("button", { name: /request a return/i }).click();
  await page.getByLabel(/^reason/i).selectOption("wrong_item");
  await page.getByLabel(/anything else/i).fill("The box said something else.");
  await page.getByRole("button", { name: /send the request/i }).click();

  await expect(page.getByText(/request sent/i)).toBeVisible();
  await expect(page.locator(".badge", { hasText: /requested/i })).toBeVisible();
  // One in flight blocks a second.
  await expect(page.getByRole("button", { name: /request a return/i })).toHaveCount(0);

  // ----- the shop answers -----
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/returns");
  const card = page.locator("article").filter({ hasText: number }).first();
  await expect(card).toContainText(/wrong item/i);
  await expect(card).toContainText("The box said something else.");

  await card.getByLabel(/reply to the shopper/i).fill("Bring it to the shop, we will swap it.");
  await card.getByRole("button", { name: /^approve$/i }).click();
  await expect(card.locator(".badge")).toHaveText(/approved/i);

  // Received: the one move that touches stock.
  await card.getByRole("button", { name: /received in stock/i }).click();
  await expect(card.locator(".badge")).toHaveText(/received/i);

  await expect.poll(() => stockOf(slug)).toBe(stockBefore + 1);

  // And the ledger says why, on the order it came from.
  await page.goto(orderUrl);
  await expect(page.locator("main")).toContainText(number);

  // ----- the shopper sees the answer -----
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await page.goto(`/order/${number}`);
  await expect(page.getByText(/the shop's reply/i)).toBeVisible();
  await expect(page.getByText("Bring it to the shop, we will swap it.")).toBeVisible();
  await expect(page.locator(".badge", { hasText: /received/i })).toBeVisible();
});
