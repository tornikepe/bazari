import { expect, test, type Page } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER as CUSTOMER, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * Switching a customer's account off, and back on.
 *
 * The column and the sign-in refusal already existed for staff; what this
 * covers is that the shop can now reach them for the people it has most of,
 * and that switching an account off is a thing that actually stops somebody
 * signing in rather than a badge on a page.
 *
 * The demo customer is used and put back, because that is the one account this
 * suite knows the password for — and knowing the password is the whole point:
 * a test that only read the badge would pass against a switch wired to
 * nothing.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password || !CUSTOMER.password, "the demo passwords are not set");

/** Opens the demo customer's page in the dashboard. */
async function openCustomer(page: Page) {
  await page.goto(`/dashboard/customers?q=${encodeURIComponent(CUSTOMER.email)}`);
  await page.locator('main table a[href^="/dashboard/customers/"]').first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** Whichever of the two buttons is currently offered. */
const theSwitch = (page: Page) => page.getByRole("button", { name: /turn (on|off) the account/i });

test("an admin can switch a customer off, and they cannot sign in @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await openCustomer(page);

  // Turning off asks first, and the answer is yes exactly once.
  page.once("dialog", (dialog) => dialog.accept());
  await theSwitch(page).click();

  try {
    await expect(page.getByRole("button", { name: /turn on the account/i })).toBeVisible();

    // The listing says so too, rather than only the record.
    await page.goto(`/dashboard/customers?q=${encodeURIComponent(CUSTOMER.email)}`);
    await expect(page.locator("main table").getByText(/^off$/i).first()).toBeVisible();

    // And the part that matters: the door is shut.
    await page.context().clearCookies();
    await useEnglish(page);
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(CUSTOMER.email);
    await page.getByLabel(/^password$/i).fill(CUSTOMER.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page, "a switched-off account signed in").toHaveURL(/\/login/);
  } finally {
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, ADMIN.email, ADMIN.password);
    await openCustomer(page);
    await page.getByRole("button", { name: /turn on the account/i }).click();
    await expect(page.getByRole("button", { name: /turn off the account/i })).toBeVisible();
  }

  // Back in, which is the other half of the promise.
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, CUSTOMER.email, CUSTOMER.password);
  await expect(page).not.toHaveURL(/\/login/);
});

test("the same switch, thrown from the selection @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto(`/dashboard/customers?q=${encodeURIComponent(CUSTOMER.email)}`);

  const row = page.locator("main table tbody tr").filter({ hasText: CUSTOMER.email });
  await row.locator('input[name="customer-id"]').check();
  // The bar counting it is the proof React saw the tick rather than the test
  // acting on an empty selection before hydration.
  await expect(page.getByText(/1 selected/)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /^turn off$/i }).click();

  try {
    await expect(page.getByRole("status").filter({ hasText: /done — 1 account/i })).toBeVisible();
    await expect(row.getByText(/^off$/i)).toBeVisible();
  } finally {
    await row.locator('input[name="customer-id"]').check();
    await expect(page.getByText(/1 selected/)).toBeVisible();
    await page.getByRole("button", { name: /^turn on$/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /done — 1 account/i })).toBeVisible();
  }

  await expect(row.getByText(/^off$/i)).toHaveCount(0);
});

test("staff are not switched from the customers table @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto(`/dashboard/customers?q=${encodeURIComponent(ADMIN.email)}`);

  /* An admin appears in this listing — it is a list of users — but carries no
     checkbox, because their account is managed on the staff page, which knows
     about the last-admin rule. The server filters on the role as well; this is
     only the offer. */
  const row = page.locator("main table tbody tr").filter({ hasText: ADMIN.email });
  await expect(row).toHaveCount(1);
  await expect(row.locator('input[name="customer-id"]')).toHaveCount(0);
});

test("a viewer is offered no switch at all @engine", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set in the environment");

  await useEnglish(page);
  await signIn(page, VIEWER.email, VIEWER.password);
  await openCustomer(page);

  await expect(theSwitch(page)).toHaveCount(0);
  await expect(page.locator('main input[name="customer-id"]')).toHaveCount(0);
});
