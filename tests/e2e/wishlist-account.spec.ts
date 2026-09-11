import { expect, test } from "@playwright/test";
import { DEMO_CUSTOMER, signIn, useEnglish } from "./helpers";

/**
 * The wishlist, on the account.
 *
 * It used to live only in `localStorage`, which is one browser until that
 * browser is cleared. Now a signed-in shopper's hearts are written to the
 * account and come back in a browser that has never seen them — which is
 * what a second context here stands in for.
 */

test.skip(!DEMO_CUSTOMER.password, "CUSTOMER_PASSWORD is not set in the environment");

test("a heart pressed in one browser is there in another, and a heart pressed before signing in is kept", async ({
  browser,
}) => {
  const first = await browser.newContext();
  const page = await first.newPage();
  await useEnglish(page);

  // ----- signed out: heart something -----
  await page.goto("/catalog");
  const card = page.locator("article").first();
  const slug = (await card.locator('a[href^="/product/"]').first().getAttribute("href"))!;
  await card.getByRole("button", { name: /add to wishlist/i }).click();
  await expect(card.getByRole("button", { name: /remove/i })).toBeVisible();

  // ----- sign in: the browser's heart is merged into the account -----
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  // Start from exactly this one, whatever earlier runs left on the account.
  await page.goto("/favorites");
  await expect(page.locator("article").first()).toBeVisible();
  await page.getByRole("button", { name: /clear/i }).click();
  await expect(page.getByText(/wishlist is empty/i)).toBeVisible();

  // The product's own heart, beside "add to cart" — not the chip on a
  // related product's card further down.
  await page.goto(slug);
  const panel = page.locator("main").locator(":scope button:has-text('Add to cart')").first().locator("xpath=..");
  await panel.getByRole("button", { name: /add to wishlist/i }).click();
  await expect(panel.getByRole("button", { name: /remove from wishlist/i })).toBeVisible();
  // Let the write land before leaving the page; a person does not navigate
  // in the same hundred milliseconds, and a write cut off by one would be
  // sent again on the next visit anyway.
  await page.waitForLoadState("networkidle");

  // The account page counts it.
  await page.goto("/account");
  await expect(page.getByRole("link", { name: /wishlist/i }).last()).toContainText("1 product");

  // ----- a second browser, signed in, with nothing in its storage -----
  const second = await browser.newContext();
  const other = await second.newPage();
  await useEnglish(other);
  await signIn(other, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await other.goto("/favorites");

  const cards = other.locator("article");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator(`a[href="${slug}"]`).first()).toBeVisible();

  // ----- and a removal there is a removal everywhere -----
  await cards.first().getByRole("button", { name: /remove/i }).click();
  await expect(other.getByText(/wishlist is empty/i)).toBeVisible();
  await other.waitForLoadState("networkidle");

  await page.reload();
  await page.goto("/favorites");
  await expect(page.getByText(/wishlist is empty/i)).toBeVisible();

  await first.close();
  await second.close();
});
