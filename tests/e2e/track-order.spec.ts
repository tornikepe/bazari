import { expect, test } from "@playwright/test";
import { DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * The tracking page, against an order this test places itself.
 *
 * It has to place one: the page is only worth anything with a real order
 * behind it, and a fixture number would drift the moment the seed changed.
 * Placing it also means the phone number is known, which is the second factor
 * the lookup requires.
 *
 * What is checked is the thing the page exists for. A status word is not an
 * answer — "pending" says nothing about what has happened, what is happening,
 * or what the shop will do next — so the assertions are about the timeline,
 * the step the order is standing on, and the steps it has not reached.
 */

const PHONE = "555000777";

async function placeAnOrder(page: import("@playwright/test").Page) {
  await seedCart(page);
  await page.goto("/checkout");

  await page.getByLabel(/full name/i).fill("E2E Tracker");
  await page.getByLabel(/phone/i).fill(PHONE);
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 9");
  await page.getByRole("button", { name: /place order/i }).click();

  await expect(page).toHaveURL(/\/order\/BZ-/, { timeout: 30_000 });
  return new URL(page.url()).pathname.replace("/order/", "");
}

/** The tracking form, scoped past the header's own search field and button. */
const trackForm = (page: import("@playwright/test").Page) => page.locator("main form");

async function look(page: import("@playwright/test").Page, number: string, phone: string) {
  await page.goto("/track");
  await page.locator("#orderNumber").fill(number);
  await page.locator("#phone").fill(phone);
  await trackForm(page).locator('button[type="submit"]').first().click();
}

test("a new order shows where it is, not just what it is called @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

  const number = await placeAnOrder(page);

  await look(page, number, PHONE);

  const progress = page.getByRole("region", { name: /where your order is/i });
  await expect(progress, "the result showed no timeline at all").toBeVisible();

  // Four steps, always — the ones ahead are named rather than hidden, so the
  // reader can see the whole journey and where they are on it.
  const steps = progress.getByRole("listitem");
  await expect(steps).toHaveCount(4);

  // Standing on the first, and it says so in a way a screen reader can hear.
  await expect(progress.locator('[aria-current="step"]')).toHaveText(/pending/i);
  await expect(steps.first(), "the current step did not explain itself").toContainText(
    /we have the order/i,
  );

  // The three ahead are explicitly *not* dated. An invented delivery date is
  // the fastest way to lose someone's trust, so there is none anywhere.
  for (const index of [1, 2, 3]) {
    await expect(steps.nth(index)).toContainText(/not yet/i);
  }

  // And what the shop does next, which is the question behind the question.
  await expect(page.getByText(/what happens next/i)).toBeVisible();
});

test("the order's own contents come back with it @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

  const number = await placeAnOrder(page);
  await look(page, number, PHONE);

  // What they bought and what they agreed to pay — both already known to the
  // person who placed it, and both missing from the old page.
  await expect(page.getByRole("heading", { name: /what is in it/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^payment$/i })).toBeVisible();
  await expect(page.getByText(/cash on delivery|bank transfer|card/i).first()).toBeVisible();
});

test("the phone number is what protects it @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

  const number = await placeAnOrder(page);

  // The order number alone is guessable — it is the pair that authorises the
  // lookup, and the refusal must not hint that the number itself was right.
  await look(page, number, "555999999");

  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)').first()).toContainText(
    /not found|check the number/i,
  );
  await expect(page.getByRole("region", { name: /where your order is/i })).toHaveCount(0);
});
