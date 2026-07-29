import { expect, test } from "@playwright/test";
import { seedCart, useEnglish } from "./helpers";

test.beforeEach(async ({ page }) => useEnglish(page));

test("a guest can place an order and reach the confirmation", async ({ page }) => {
  await seedCart(page);
  await page.goto("/checkout");

  await page.getByLabel(/full name/i).fill("E2E Guest");
  await page.getByLabel(/phone/i).fill("555000111");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 1");

  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page).toHaveURL(/\/order\/BZ-/);
  await expect(page.getByRole("heading", { name: /order received/i })).toBeVisible();
});

test("checkout refuses to submit with the required fields empty", async ({ page }) => {
  await seedCart(page);
  await page.goto("/checkout");

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
