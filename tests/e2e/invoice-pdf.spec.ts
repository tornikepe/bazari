import { expect, test } from "@playwright/test";
import { DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * The invoice as a file.
 *
 * The order page offers it, the route draws it from the order's own columns,
 * and nobody else can fetch it by guessing the number.
 */

test.skip(!DEMO_CUSTOMER.password, "CUSTOMER_PASSWORD is not set in the environment");

test("the customer can download their invoice as a PDF, and a stranger cannot", async ({
  page,
  browser,
}) => {
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await seedCart(page);
  await page.goto("/checkout");
  await page.getByLabel(/full name/i).fill("PDF Buyer");
  await page.getByLabel(/phone/i).fill("555000555");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 5");
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page).toHaveURL(/\/order\/BZ-/);
  const number = page.url().split("/").pop()!;

  // The link is there, and what it points at is a PDF with the number in
  // its file name.
  const link = page.getByRole("link", { name: /download pdf/i });
  await expect(link).toBeVisible();
  const response = await page.request.get(`/api/orders/${number}/invoice`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toContain(`${number}.pdf`);
  const body = await response.body();
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(body.byteLength).toBeGreaterThan(5_000);

  // Somebody else with the number gets nothing — and not "forbidden", which
  // would confirm the number exists.
  const stranger = await browser.newContext();
  const strangerResponse = await stranger.request.get(`/api/orders/${number}/invoice`);
  expect(strangerResponse.status()).toBe(404);
  await stranger.close();
});
