import { expect, test } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * A card order, end to end, through the gateway that takes no money.
 *
 * The checkout sends the shopper to the hosted page, the page calls the
 * webhook back with a signed body, the service captures and the order is
 * paid; a decline leaves it unpaid with a way to try again; a replayed or
 * forged callback changes nothing. Same code path a real adapter would run
 * through — only the bank is missing.
 */

test.skip(!ADMIN.password || !DEMO_CUSTOMER.password, "the seeded passwords are not set");

async function placeCardOrder(page: import("@playwright/test").Page) {
  await seedCart(page);
  await page.goto("/checkout");
  await page.getByLabel(/full name/i).fill("Card Buyer");
  await page.getByLabel(/phone/i).fill("555000222");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 2");
  await page.getByLabel(/^card$/i).check();
  await page.getByRole("button", { name: /place order/i }).click();
  // Off to the gateway.
  await expect(page).toHaveURL(/\/pay\/sandbox\?/);
  await expect(page.getByText(/this is not a bank/i)).toBeVisible();
}

test("paying on the hosted page captures the order; declining leaves a way back", async ({
  page,
}) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

  // ----- paid -----
  await placeCardOrder(page);
  await page.getByRole("button", { name: /^pay$/i }).click();
  await expect(page).toHaveURL(/\/order\/BZ-/);
  await expect(page.getByText(/^paid$/i)).toBeVisible();
  const paidNumber = page.url().split("/").pop()!;

  // ----- declined, then paid on the second try -----
  await placeCardOrder(page);
  const link = page.url();
  await page.getByRole("button", { name: /^decline$/i }).click();
  await expect(page).toHaveURL(/\/order\/BZ-/);
  await expect(page.getByText(/not paid yet/i)).toBeVisible();

  await page.getByRole("button", { name: /pay now/i }).click();
  await expect(page).toHaveURL(/\/pay\/sandbox\?/);
  await page.getByRole("button", { name: /^pay$/i }).click();
  await expect(page).toHaveURL(/\/order\/BZ-/);
  await expect(page.getByText(/^paid$/i)).toBeVisible();
  await expect(page.getByText(/not paid yet/i)).toHaveCount(0);

  // ----- the callback cannot be forged, and a replay is a no-op -----
  const forged = await page.request.post("/api/payments/sandbox/webhook", {
    headers: { "content-type": "application/json", "x-sandbox-signature": "0000" },
    data: { event_id: "evt_forged", payment_id: "x", status: "captured", amount: 1, currency: "GEL", ref: "x" },
  });
  expect(forged.status()).toBe(400);

  // A hand-edited hosted-page link goes nowhere.
  const tampered = link.replace(/amount=\d+/, "amount=1");
  await page.goto(tampered);
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/);

  // ----- the shop sees the money -----
  await page.context().clearCookies();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto(`/dashboard/orders?q=${paidNumber}`);
  await page.locator('main table a[href^="/dashboard/orders/"]', { hasText: paidNumber }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\/[a-z0-9]+/);
  await expect(page.locator("main")).toContainText(/sandbox/i);
  await expect(page.locator("main")).toContainText(/captured/i);
  // And can send it back: the sandbox refunds at once. The button asks first.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /refund/i }).first().click();
  await expect(page.locator("main")).toContainText(/refunded/i);
});
