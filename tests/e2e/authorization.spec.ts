import { expect, test } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * Who can see what. These are the tests that would have caught the two real
 * data-exposure bugs this project has had, so they matter more than the happy
 * paths.
 */
test.beforeEach(async ({ page }) => useEnglish(page));

test("an anonymous visitor is sent to sign in, not to the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("an anonymous visitor cannot reach the account area", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});

test("a customer cannot reach the admin dashboard", async ({ page }) => {
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await expect(page).toHaveURL(/\/account/);

  await page.goto("/dashboard");
  await expect(page).not.toHaveURL(/\/dashboard$/);
});

test("a stranger cannot open an order they did not place", async ({ page, context }) => {
  // Order numbers were once sequential and this page was public, which exposed
  // every customer's name, phone and address. The buyer keeps a signed receipt
  // cookie; anyone else is sent to /track, which demands the phone number.
  await seedCart(page);
  await page.goto("/checkout");
  await page.getByLabel(/full name/i).fill("E2E Owner");
  await page.getByLabel(/phone/i).fill("555000222");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 2");
  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page).toHaveURL(/\/order\/BZ-/);
  const orderUrl = page.url();

  // Same order, different visitor.
  await context.clearCookies();
  await page.goto(orderUrl);

  await expect(page).toHaveURL(/\/track/);
  await expect(page.locator("body")).not.toContainText("Rustaveli 2");
});

test("an unknown order number 404s rather than erroring", async ({ page }) => {
  const response = await page.goto("/order/definitely-not-a-number");
  expect(response?.status()).toBe(404);
});

test("the sign-in form does not reveal which field was wrong", async ({ page }) => {
  await signIn(page, "nobody@example.test", "wrongpassword");

  // Next's route announcer is also role="alert" and lives outside any layout,
  // so it is excluded by id rather than by scoping to a container.
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText(/no such (user|account)|unknown email/i);
});

test.describe("admin", () => {
  test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set");

  test("an admin lands on the dashboard, not the customer account", async ({ page }) => {
    await signIn(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
