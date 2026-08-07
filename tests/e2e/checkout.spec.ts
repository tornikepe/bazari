import { expect, test } from "@playwright/test";
import { countPendingEvents, DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  // Buying requires an account. It did not always, which is what these tests
  // were originally written against.
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
});

test("a signed-in customer can place an order and reach the confirmation", async ({ page }) => {
  await seedCart(page);
  await page.goto("/checkout");

  // The form arrives prefilled from the account, so this overwrites rather
  // than fills — requiring an account and then demanding the address again
  // would be the worst of both.
  await page.getByLabel(/full name/i).fill("E2E Buyer");
  await page.getByLabel(/phone/i).fill("555000111");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 1");

  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page).toHaveURL(/\/order\/BZ-/);
  await expect(page.getByRole("heading", { name: /order received/i })).toBeVisible();
});

test("a placed order opens its history exactly once", async ({ page }) => {
  await seedCart(page);
  await page.goto("/checkout");
  await page.getByLabel(/full name/i).fill("E2E Timeline");
  await page.getByLabel(/phone/i).fill("555000333");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 3");
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page).toHaveURL(/\/order\/BZ-/);

  const number = page.url().split("/").pop()!;

  // The order row already creates its opening event as a nested write. A
  // second explicit `orderEvent.create` next to it wrote the same row twice,
  // and the dashboard showed "Pending / Pending" with identical timestamps.
  // Counted from the database, because the page renders whatever is there.
  await expect
    .poll(async () => countPendingEvents(number))
    .toBe(1);
});

test("checkout sends a signed-out visitor to sign in first", async ({ page }) => {
  await page.context().clearCookies();
  await useEnglish(page);
  await seedCart(page);

  await page.goto("/checkout");

  // And remembers where they were going.
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
});

test("checkout refuses to submit with the required fields empty", async ({ page }) => {
  await seedCart(page);
  await page.goto("/checkout");

  // Cleared, because the account prefills them.
  for (const field of [/full name/i, /phone/i, /city/i, /^address/i]) {
    await page.getByLabel(field).fill("");
  }

  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page).not.toHaveURL(/\/order\//);
  await expect(page.getByText(/required/i).first()).toBeVisible();
});

test("a valid coupon reduces the total, and removing it restores it", async ({ page }) => {
  // WELCOME10 is 10% off over ₾50, so seed enough to clear the minimum.
  await seedCart(page, 2);
  await page.goto("/checkout");

  const total = page.locator("aside dl").last();
  const before = await total.innerText();

  await page.getByPlaceholder(/enter code/i).fill("WELCOME10");
  await page.getByRole("button", { name: /^apply$/i }).click();

  await expect(page.getByText(/code applied/i)).toBeVisible();
  await expect(total).toContainText(/discount/i);
  expect(await total.innerText()).not.toBe(before);

  await page.getByRole("button", { name: /^remove$/i }).click();
  await expect(total).not.toContainText(/discount/i);
});

test("an unknown coupon is rejected without changing the total", async ({ page }) => {
  await seedCart(page);
  await page.goto("/checkout");

  const total = page.locator("aside dl").last();
  const before = await total.innerText();

  await page.getByPlaceholder(/enter code/i).fill("NOTAREALCODE");
  await page.getByRole("button", { name: /^apply$/i }).click();

  await expect(page.getByText(/no such code/i)).toBeVisible();
  expect(await total.innerText()).toBe(before);
});

test("the cart page shows an empty state before anything is added", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByText(/cart is empty/i)).toBeVisible();
});
