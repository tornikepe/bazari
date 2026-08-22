import { expect, test } from "@playwright/test";
import { DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * What the checkout says when it cannot take the order.
 *
 * Every failure used to end "please try again", which is advice only when
 * trying again could work. A cart holding a product that has been withdrawn
 * fails on the second press exactly as it failed on the first, and the shopper
 * is left pressing a button that cannot succeed. Each cause now says what
 * happened and offers the way out of it.
 */

/** Puts a product that does not exist into the cart, as a stale one would be. */
async function poisonTheCart(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!/cart/i.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const value = JSON.parse(raw);
        const items = Array.isArray(value) ? value : value?.items;
        if (!Array.isArray(items) || items.length === 0) continue;
        // The id of a product that has been deleted looks exactly like this to
        // the server: a line referring to something it cannot find.
        items[0].productId = "gone-forever";
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* not ours */
      }
    }
  });
}

test("a cart holding something withdrawn is sent to the cart, not told to retry @engine", async ({
  page,
}) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await seedCart(page);

  await page.goto("/checkout");
  await poisonTheCart(page);
  await page.reload();

  await page.getByLabel(/full name/i).fill("Stale Cart");
  await page.getByLabel(/phone/i).fill("555000888");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 11");
  await page.getByRole("button", { name: /place order/i }).click();

  const note = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();

  // Not "try again": the cart has to change first, so the note says so and
  // hands over the only control that can change it.
  await expect(note).toContainText(/no longer for sale/i);
  await expect(note).not.toContainText(/try again/i);

  const way = note.getByRole("link", { name: /open the cart/i });
  await expect(way, "the failure offered no way out of itself").toBeVisible();

  await way.click();
  await expect(page).toHaveURL(/\/cart$/);
});

test("an empty cart points at the catalogue @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

  // Straight to the checkout with nothing in the cart at all.
  await page.goto("/checkout");

  // The page itself already refuses an empty cart before the form appears,
  // which is the correct place for it — the point of this test is that the
  // refusal leads somewhere.
  await expect(page.getByRole("link", { name: /catalog|continue shopping/i }).first()).toBeVisible();
});
