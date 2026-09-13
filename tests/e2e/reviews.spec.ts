import { expect, test } from "@playwright/test";
import { ADMIN, seedCart, signIn, uniqueEmail, useEnglish } from "./helpers";

/**
 * A review from somebody who bought the thing.
 *
 * The whole rule, walked: before the order is delivered the form is not
 * there; after, it is; what is written appears on the product with its star
 * and in the structured data; the shop can hide it and it goes.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

test("only a delivered order earns a review, and the shop can hide one", async ({ page }) => {
  test.slow();

  // ----- a stranger sees the rule, not a form -----
  await useEnglish(page);
  const slug = await seedCart(page);
  await page.goto(`/product/${slug}`);
  await expect(page.getByText(/sign in to write a review/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /write a review/i })).toHaveCount(0);

  // ----- a customer of this test's own buys -----
  /* Not the demo customer: the seed and the other specs have delivered
     orders of every product to that account, so it may review anything and
     the "not yet" half of the rule could not be seen. */
  const email = uniqueEmail("reviewer");
  const password = "e2epassword123";
  await page.goto("/register");
  await page.getByLabel(/full name/i).fill("E2E Reviewer");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/^password/i).fill(password);
  await page.getByLabel(/confirm/i).fill(password);
  await page.getByRole("button", { name: /sign up|create/i }).click();
  await expect(page).toHaveURL(/\/verify/);
  await page.goto("/checkout");
  await page.getByLabel(/full name/i).fill("E2E Reviewer");
  await page.getByLabel(/phone/i).fill("555000666");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 6");
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page).toHaveURL(/\/order\/BZ-/);
  const number = page.url().split("/").pop()!;

  // Placed is not delivered: still no form, and the reason says so.
  await page.goto(`/product/${slug}`);
  await expect(page.getByText(/on its way/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /write a review/i })).toHaveCount(0);

  // ----- the shop delivers -----
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto(`/dashboard/orders?q=${number}`);
  await page.locator('main table a[href^="/dashboard/orders/"]', { hasText: number }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\/[a-z0-9]+/);
  await page.getByLabel(/update status/i).selectOption("delivered");
  await expect(page.locator("main")).toContainText(/delivered/i);

  // ----- the customer reviews -----
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, email, password);
  await page.goto(`/product/${slug}#reviews`);
  await page.getByRole("button", { name: /write a review|change your review/i }).click();
  // The star is the control a person sees; the radio behind it is what a
  // screen reader and the arrow keys use. Click the star, check the radio.
  await page.locator('label:has(input[aria-label="4 stars"])').click();
  await expect(page.getByRole("radio", { name: /4 stars/i })).toBeChecked();
  await page.getByLabel(/^title/i).fill("Does the job");
  await page.getByLabel(/what you would tell a friend/i).fill("Arrived in two days, works as described.");
  await page.getByRole("button", { name: /^publish$/i }).click();
  await expect(page.getByText(/your review is published/i)).toBeVisible();

  // On the page, with its star, marked as what it is.
  const reviews = page.locator("#reviews");
  await expect(reviews).toContainText("Does the job");
  await expect(reviews).toContainText(/verified purchase/i);
  await expect(reviews).toContainText(/your review/i);
  // And in the structured data — real, so present.
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((json) => json.includes('"aggregateRating"'))).toBe(true);

  // ----- the shop hides it -----
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/reviews?view=all");
  const card = page.locator("article").filter({ hasText: "Does the job" }).first();
  await expect(card).toContainText(number);
  await card.getByRole("button", { name: /^hide$/i }).click();
  await expect(card.locator(".badge")).toHaveText(/hidden/i);

  await page.context().clearCookies();
  await useEnglish(page);
  await page.goto(`/product/${slug}#reviews`);
  await expect(page.locator("#reviews")).not.toContainText("Does the job");
});
