import { expect, test, type Page } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, VIEWER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * Discount codes, from the dashboard to the checkout.
 *
 * The table, the validation and the checkout field have all worked since the
 * beginning — the only way to create a coupon was Prisma Studio. So the test
 * that matters is the round trip: a code typed in here has to be a code a
 * shopper can actually use, which is the one thing a page that only wrote to
 * the database would not prove.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

const CODE = `E2E${Date.now().toString().slice(-6)}`;

async function openCoupons(page: Page) {
  await page.goto("/dashboard/coupons");
  await expect(page.getByRole("heading", { name: /coupons/i })).toBeVisible();
}

test("a coupon created here can be used at the checkout @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await openCoupons(page);

  await page.getByRole("button", { name: /new coupon/i }).click();
  await page.getByLabel(/^code$/i).fill(CODE);
  await page.getByLabel(/^value$/i).fill("10");
  await page.getByRole("button", { name: /^save$/i }).click();

  const row = page.locator("li").filter({ hasText: CODE });
  await expect(row).toBeVisible();
  await expect(row.getByText(/−10%/)).toBeVisible();

  // The round trip: the shopper's side.
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await seedCart(page);
  await page.goto("/checkout");

  await page.getByPlaceholder(/enter code/i).fill(CODE);
  await page.getByRole("button", { name: /apply/i }).click();

  /* The confirmation, and then the money: a code that reports itself applied
     while the total is unchanged is the failure worth catching. */
  await expect(page.getByText(/code applied/i)).toBeVisible();
  await expect(page.getByText(/^−₾/).first()).toBeVisible();
});

test("turning it off stops it being accepted, and keeps the row @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await openCoupons(page);

  const row = page.locator("li").filter({ hasText: CODE });
  await row.getByRole("button", { name: /turn off/i }).click();
  await expect(row.getByText(/^off$/i)).toBeVisible();

  // Still there: orders point at the coupon they were placed with, and
  // deleting it would leave a discount in a total with nothing to explain it.
  await expect(row).toBeVisible();

  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await seedCart(page);
  await page.goto("/checkout");

  await page.getByPlaceholder(/enter code/i).fill(CODE);
  await page.getByRole("button", { name: /apply/i }).click();

  // Word for word the answer an unknown code gets: a shopper has no business
  // learning that a code exists but has been withdrawn.
  await expect(page.getByText(/no such code/i)).toBeVisible();
  await expect(page.getByText(/code applied/i)).toHaveCount(0);
});

test("a duplicate code is refused by name @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await openCoupons(page);

  await page.getByRole("button", { name: /new coupon/i }).click();
  await page.getByLabel(/^code$/i).fill(CODE);
  await page.getByLabel(/^value$/i).fill("5");
  await page.getByRole("button", { name: /^save$/i }).click();

  await expect(page.getByText(/already exists/i)).toBeVisible();
});

test("a viewer can read the codes and change none of them @engine", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set in the environment");

  await useEnglish(page);
  await signIn(page, VIEWER.email, VIEWER.password);
  await openCoupons(page);

  await expect(page.getByText(CODE)).toBeVisible();
  await expect(page.getByRole("button", { name: /new coupon/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /turn off|turn on/i })).toHaveCount(0);
});
