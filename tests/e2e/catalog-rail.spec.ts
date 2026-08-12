import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * The catalogue's filter rail.
 *
 * `position: sticky` pins the rail to the top of the viewport and then lets it
 * run off the bottom, which is fine for a short list and useless for this one:
 * the brand and category filters are taller than a laptop screen, so the
 * bottom of the rail could only be reached by scrolling the whole page down
 * past it — and by then the rail had scrolled out of view too. It needs its
 * own scroll container.
 */

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/catalog");
});

const rail = (page: import("@playwright/test").Page) =>
  page.locator("aside .card").first();

test("the rail scrolls inside itself @engine", async ({ page }) => {
  const box = await rail(page).evaluate((node) => ({
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    overflowY: getComputedStyle(node).overflowY,
  }));

  expect(box.overflowY, "the rail needs its own scroll container").toBe("auto");
  // Taller than it can show, which is the whole reason this matters.
  expect(box.scrollHeight).toBeGreaterThan(box.clientHeight);

  await rail(page).evaluate((node) => node.scrollBy(0, 400));
  await expect
    .poll(async () => rail(page).evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);
});

test("scrolling the rail does not move the page @engine", async ({ page }) => {
  const before = await page.evaluate(() => window.scrollY);

  // Deliberately less than the rail's own remaining scroll. Past its end the
  // page *should* take over — that is what a mouse wheel does everywhere, and
  // `overscroll-contain` only stops the hand-off inside one continuous
  // gesture, not across separate wheel ticks. The bug being pinned here is the
  // one before that point: the rail not scrolling at all.
  const room = await rail(page).evaluate((node) => node.scrollHeight - node.clientHeight);
  expect(room, "the rail should have something to scroll").toBeGreaterThan(120);

  // Near the rail's top edge on purpose. The brand list inside it is its own
  // capped scroll area, and hovering the middle of the rail lands on that —
  // the wheel then scrolls the brands and the rail sits still, which looks
  // like this test failing rather than like the nested list working.
  const box = (await rail(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 12);
  await page.mouse.wheel(0, Math.floor(room / 2));

  // Polled, not read once: `html { scroll-behavior: smooth }` is global, so it
  // applies to this container too and `scrollTop` is still 0 for a few frames
  // after the wheel. Reading immediately reports the animation's start value
  // and fails on working code.
  await expect
    .poll(async () => rail(page).evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0);

  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});

test("the rail never runs off the bottom of the screen @engine", async ({ page }) => {
  // `behavior: "instant"` on purpose, for the reason the test above documents:
  // `html { scroll-behavior: smooth }` is global, so a plain `scrollBy` starts
  // an animation and the rail — which is sticky — is still settling for several
  // frames afterwards. Reading the rectangle immediately catches it mid-flight
  // and reports a rail hanging past the fold on working code. Chromium happened
  // to settle inside the gap and WebKit did not, which is how this arrived as a
  // one-engine flake rather than as the timing bug it is.
  await page.evaluate(() => window.scrollBy({ top: 800, behavior: "instant" }));

  const { bottom, viewport } = await rail(page).evaluate((node) => ({
    bottom: node.getBoundingClientRect().bottom,
    viewport: window.innerHeight,
  }));

  expect(bottom).toBeLessThanOrEqual(viewport + 1);
});

test("the bottom of the filter list is reachable @engine", async ({ page }) => {
  // The reset button is the last thing in the rail. If it cannot be reached
  // without scrolling the page away, the rail is not doing its job.
  const reset = page.getByRole("button", { name: /clear|გასუფთავება/i }).last();

  await reset.scrollIntoViewIfNeeded();
  await expect(reset).toBeInViewport();
});
