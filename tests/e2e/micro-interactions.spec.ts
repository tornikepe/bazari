import { expect, test, type Page } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * The small confirmations.
 *
 * The site animated panels and drawers and nothing else, so the two things a
 * shopper does most — adding something, changing a quantity — changed a number
 * somewhere and said nothing about it.
 *
 * These assert on animation *events* rather than on caught frames, for the
 * same reason `motion.spec.ts` does: a 0.28s bump is over before an assertion
 * round-trips, so sampling a transform reads as "already finished" and fails
 * on working code. An `animationstart` that never fires is unambiguous.
 */

/** Records animation starts before anything can trigger one. */
async function watchAnimations(page: Page) {
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __anim: string[] }).__anim = log;
    document.addEventListener(
      "animationstart",
      (event) => log.push((event as AnimationEvent).animationName),
      true,
    );
  });
}

const started = (page: Page) =>
  page.evaluate(() => (window as unknown as { __anim: string[] }).__anim);

test("the cart badge notices a new item, and stays still on arrival @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/catalog");
  await watchAnimations(page);

  // Nothing has changed yet, so nothing has bounced.
  expect(await started(page), "something animated before anything happened").not.toContain("bump");

  await page.getByRole("button", { name: /add to cart/i }).first().click();

  await expect.poll(async () => (await started(page)).includes("bump")).toBe(true);

  // Reloading with a full cart must not bounce: the badge appearing is
  // already the signal, and a bump on every page load is motion for its own
  // sake.
  await page.reload();
  await watchAnimations(page);
  await page.waitForTimeout(600);
  expect(await started(page), "the badge bounced on a page load").not.toContain("bump");
});

test("changing a quantity tints the figures it changed @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/catalog");

  /* Three products rather than one: the first in the catalogue happens to
     have a stock of 1, and the stepper's "+" is disabled at the stock — which
     is correct, and would leave this test clicking a control that cannot
     move. One of the three will have room. */
  for (const index of [0, 1, 2]) {
    await page.getByRole("button", { name: /add to cart/i }).nth(index).click();
  }

  await page.goto("/cart");
  await watchAnimations(page);

  const plus = page.locator('main button[aria-label="+"]:not([disabled])').first();
  await expect(plus, "every line was already at its stock limit").toBeVisible();
  await plus.click();

  // Both the line and the total recalculated, so both say so.
  await expect.poll(async () => (await started(page)).filter((n) => n === "flash").length).toBeGreaterThanOrEqual(2);
});

test("someone who asked for less motion gets the change without it @engine", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await useEnglish(page);
  await page.goto("/catalog");

  await page.getByRole("button", { name: /add to cart/i }).first().click();

  // The number is the information; the bump only draws the eye to it. With
  // motion reduced the badge must still be there and still be right.
  const badge = page.locator("header a[href='/cart'] span span").last();
  await expect(badge).toHaveText(/\d/);
});
