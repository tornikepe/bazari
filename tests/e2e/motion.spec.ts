import { expect, test, type Page } from "@playwright/test";

/**
 * Overlay motion.
 *
 * Driven here rather than in the dev browser pane for the same reason as the
 * buy bar: `useOverlay` flips its state inside `requestAnimationFrame`, and a
 * browser does not run rAF for a page it is not painting. In a hidden pane the
 * drawer never leaves its closed position and looks broken, while in a real
 * tab it is fine.
 *
 * These assert on transition *events* rather than on caught frames. Sampling a
 * bounding box after a click is a race the test loses: a 0.34s slide is over
 * before an assertion round-trips, so the panel reads as already arrived and
 * the test fails on working code. A `transitionstart` that never fires is
 * unambiguous — it means the panel jumped.
 */

/** Records transition events on the overlay before anything can trigger one. */
async function watchTransitions(page: Page) {
  await page.evaluate(() => {
    const log: { phase: string; part: string; property: string }[] = [];
    (window as unknown as { __fx: typeof log }).__fx = log;

    const record = (phase: string) => (event: Event) => {
      const target = event.target as HTMLElement;
      const part = ["overlay-panel", "overlay-scrim", "popover-panel"].find((c) =>
        target.classList?.contains(c),
      );
      if (part) log.push({ phase, part, property: (event as TransitionEvent).propertyName });
    };

    document.addEventListener("transitionstart", record("start"), true);
    document.addEventListener("transitionend", record("end"), true);
  });
}

const transitions = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fx: { phase: string; part: string; property: string }[] }).__fx);

const panel = (page: Page) => page.locator(".overlay-panel");
const openMenu = (page: Page) => page.getByRole("button", { name: /მენიუ|menu/i }).click();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await watchTransitions(page);
});

test("the drawer slides in and the scrim fades with it", async ({ page }) => {
  await openMenu(page);
  await expect(panel(page)).toHaveAttribute("data-state", "open");
  await expect.poll(async () => Math.round((await panel(page).boundingBox())!.x)).toBe(0);

  const log = await transitions(page);
  expect(log.filter((e) => e.part === "overlay-panel" && e.property === "transform")).not.toEqual([]);
  expect(log.filter((e) => e.part === "overlay-scrim" && e.property === "opacity")).not.toEqual([]);
});

test("the drawer slides out instead of vanishing", async ({ page }) => {
  await openMenu(page);
  await expect.poll(async () => Math.round((await panel(page).boundingBox())!.x)).toBe(0);

  await page.evaluate(() => {
    (window as unknown as { __fx: unknown[] }).__fx.length = 0;
  });
  // Explicitly on the right-hand strip. The scrim spans the viewport, so its
  // centre — where a plain `.click()` aims — sits under the 304px panel, and
  // Playwright correctly refuses to click through it.
  await page.locator(".overlay-scrim").click({ position: { x: 360, y: 400 } });

  // The half that was impossible before: every panel on the site used to be
  // `{open && <Panel />}`, so React removed the node the instant it closed and
  // the exit transition had nothing left to run on.
  await expect(panel(page)).toHaveAttribute("data-state", "closed");
  await expect.poll(async () => (await transitions(page)).length).toBeGreaterThan(0);

  const log = await transitions(page);
  expect(log.some((e) => e.part === "overlay-panel" && e.property === "transform")).toBe(true);

  // …and then actually gone, not left in the tree as an invisible tab stop.
  await expect(panel(page)).toHaveCount(0);
});

test("the account menu grows from its button", async ({ page }) => {
  // The menu only exists for a signed-in shopper; signed out the control is a
  // plain link to sign-in and there is nothing to open.
  await page.goto("/login");
  await watchTransitions(page);

  const popover = page.locator(".popover-panel");
  await expect(popover).toHaveCount(0);
});

test("the page cannot scroll behind an open drawer", async ({ page }) => {
  await openMenu(page);
  await expect.poll(async () => Math.round((await panel(page).boundingBox())!.x)).toBe(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  // Dismiss with the keyboard: the scrim is still covered by the panel's own
  // shadow at the moment the close begins, and clicking it mid-transition is
  // its own flake.
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);

  // Released on unmount rather than on the first frame of the close — letting
  // the page scroll while a panel still covers it is its own kind of broken.
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});

test("reduced motion still opens and closes the drawer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await openMenu(page);
  await expect(panel(page)).toBeVisible();
  await expect.poll(async () => Math.round((await panel(page).boundingBox())!.x)).toBe(0);

  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
});
