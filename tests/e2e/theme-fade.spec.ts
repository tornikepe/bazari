import { expect, test } from "@playwright/test";

/**
 * Switching themes fades rather than cuts.
 *
 * Checked by looking at the animation registry, not by watching it. The first
 * implementation of this used a CSS transition, reported a correct `0.7s` on
 * every element, and animated nothing whatsoever — every colour on the site is
 * `var(--color-…)`, and an unregistered custom property is not animatable, so
 * flipping `data-theme` recomputes the dependent colours without starting a
 * transition. A test that asserted `transition-duration` would have passed on
 * that. This asserts a running animation instead.
 */

const toggle = (page: import("@playwright/test").Page) =>
  page.locator("button[aria-label]").filter({ has: page.locator(".theme-icon-moon") }).first();

test("the theme changes when the control is pressed @engine", async ({ page }) => {
  await page.goto("/");

  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await toggle(page).click();

  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
    .not.toBe(before);
});

test("the change is a cross-fade, not a cut @engine", async ({ page }) => {
  await page.goto("/");

  const supported = await page.evaluate(() => typeof document.startViewTransition === "function");
  test.skip(!supported, "this engine has no View Transitions API — the toggle falls back to an instant switch");

  // Started from inside the page so the registry can be read on the very next
  // frame; going through a click would race the sampling.
  const fade = await page.evaluate(async () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";

    const transition = document.startViewTransition(() => {
      root.dataset.theme = next;
    });
    await transition.ready;

    // View-transition pseudo-elements register real CSS animations. Reading
    // them is immune to the timer throttling that makes sampling a colour
    // mid-fade unreliable.
    // `pseudoElement` lives on KeyframeEffect, not on the AnimationEffect base
    // the registry is typed with.
    const pseudoOf = (animation: Animation) =>
      String((animation.effect as KeyframeEffect | null)?.pseudoElement ?? "");

    return document
      .getAnimations()
      .filter((animation) => pseudoOf(animation).includes("view-transition"))
      .map((animation) => ({
        pseudo: pseudoOf(animation),
        duration: Number(animation.effect?.getTiming().duration ?? 0),
      }));
  });

  expect(fade.length, "no view-transition animation was running").toBeGreaterThan(0);

  // The slow fade that was asked for, rather than the 250ms default.
  const root = fade.filter((f) => f.pseudo.includes("(root)"));
  expect(root.length, "the root snapshot is not being animated").toBeGreaterThan(0);
  for (const animation of root) {
    expect(animation.duration, `${animation.pseudo} runs for ${animation.duration}ms`).toBe(700);
  }
});

test("reduced motion gets the change without the fade @engine", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const before = await page.evaluate(() => document.documentElement.dataset.theme);

  const started = await page.evaluate(() => {
    let used = false;
    const real = document.startViewTransition;
    if (typeof real === "function") {
      // Replaced for the length of one click, then left — the page is thrown
      // away at the end of the test.
      document.startViewTransition = ((callback: () => void) => {
        used = true;
        return real.call(document, callback);
      }) as typeof document.startViewTransition;
    }
    (document.querySelector("button .theme-icon-moon")?.closest("button") as HTMLElement)?.click();
    return used;
  });

  // The theme still has to change — a missing fade is a nicety, a control that
  // does nothing is a bug.
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
    .not.toBe(before);

  expect(started, "a view transition was started despite reduced motion").toBe(false);
});
