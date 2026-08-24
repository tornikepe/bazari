import { expect, test } from "@playwright/test";
import { seedCart, useEnglish } from "./helpers";

/**
 * What a screen reader is told when the cart changes.
 *
 * Adding to a basket is the one action on a shop that changes state without
 * changing the page: the button says what it said, and the feedback lives in a
 * header count nowhere near the focus. Without a live region the whole thing is
 * silent.
 *
 * The assertions read the region's text rather than checking that a region
 * exists. `role="status"` on an empty element is markup, not an announcement.
 */

const announcer = (page: import("@playwright/test").Page) =>
  // The storefront's own region, not the route announcer Next renders.
  page.locator('[role="status"]:not(#__next-route-announcer__)').first();

/**
 * The cards that can actually be bought.
 *
 * Not `article` — the catalogue can open on a product the checkout suite has
 * sold out, and an out-of-stock card carries no add-to-cart button at all. A
 * test that took the first card would then wait for a control that is not
 * there and fail about the announcer, which was working perfectly.
 */
/** In both languages: one of these tests runs before the locale is switched. */
const ADD_TO_CART = /add to cart|კალათაში/i;

const buyableCards = (page: import("@playwright/test").Page) =>
  page.locator("article").filter({ has: page.getByRole("button", { name: ADD_TO_CART }) });

test("adding a product says what was added @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/catalog");

  const first = buyableCards(page).first();
  const productName = (await first.locator("h3, h2").first().innerText()).trim();
  await first.getByRole("button", { name: ADD_TO_CART }).click();

  await expect(announcer(page), "nothing was announced when a product was added").toContainText(
    /added to the cart/i,
  );
  // The product, by name — "an item was added" is not what happened.
  await expect(announcer(page)).toContainText(productName.split(/\s+/)[0]!);
});

test("the announcement carries the new total @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/catalog");

  await buyableCards(page).first().getByRole("button", { name: ADD_TO_CART }).click();
  await expect(announcer(page)).toContainText(/1 in total/i);

  await buyableCards(page).nth(1).getByRole("button", { name: ADD_TO_CART }).click();
  await expect(announcer(page), "the running total did not follow").toContainText(/2 in total/i);
});

test("removing from the cart page is announced too @engine", async ({ page }) => {
  await useEnglish(page);
  await seedCart(page);
  await page.goto("/cart");

  // The old implementation lived on the add-to-cart button, so this — the
  // change made furthest from that button — was silent.
  await page.getByRole("button", { name: /remove|delete/i }).first().click();

  await expect(announcer(page), "removing an item announced nothing").toContainText(
    /removed from the cart|the cart is empty/i,
  );
});

test("a cart restored from a previous visit is not announced @engine", async ({ page }) => {
  await useEnglish(page);
  await seedCart(page);

  // A fresh page load with items already in storage. Announcing here would
  // greet every visit with a summary of a basket filled yesterday.
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(700);

  await expect(
    announcer(page),
    "a cart restored from storage was announced as though it had just happened",
  ).toHaveText("");
});

test("the region is polite and out of sight @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/catalog");
  await buyableCards(page).first().getByRole("button", { name: ADD_TO_CART }).click();
  await expect(announcer(page)).not.toHaveText("");

  const region = await announcer(page).evaluate((el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      atomic: el.getAttribute("aria-atomic"),
      // `sr-only`: present to a screen reader, absent to everyone else.
      clipped: style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)",
      tiny: box.width <= 1 && box.height <= 1,
    };
  });

  expect(region.atomic, "a partial re-read says half a sentence").toBe("true");
  expect(region.clipped && region.tiny, "the live region is visible on the page").toBe(true);
});

test("the add-to-cart button no longer carries its own live region @engine", async ({ page }) => {
  await page.goto("/catalog");

  // A live region on the control whose own label is changing announces the
  // label rather than the event, and only while that control is on screen.
  const onButton = await buyableCards(page)
    .first()
    .getByRole("button", { name: ADD_TO_CART })
    .getAttribute("aria-live");

  expect(onButton, "the anti-pattern came back").toBeNull();
});
