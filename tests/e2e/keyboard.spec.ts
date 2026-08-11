import { expect, test } from "@playwright/test";

/**
 * The site driven by keyboard alone.
 *
 * The tests that press Tab carry `@tab-order` and do not run on WebKit. That is
 * not a gap being papered over: Safari does not put links or buttons in the tab
 * order at all unless the reader turns on "Use keyboard navigation to move
 * focus between controls", which is off by default. Measured rather than
 * assumed — in WebKit, Tab on the home page cycles between the body and the one
 * text input and reaches nothing else. A focus trap keyed on Tab has nothing to
 * trap there, so asserting it would be asserting a fiction.
 *
 * Everything here is checked by pressing keys and reading where focus went,
 * not by asserting that an attribute is present. `aria-modal="true"` on a
 * drawer that lets Tab wander out into the page behind it is a claim, not a
 * behaviour, and the attribute is exactly what a test that trusts markup would
 * have passed on.
 */

const active = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "body";
    const label =
      el.getAttribute("aria-label") ??
      (el.textContent ?? "").trim().slice(0, 20) ??
      "";
    return `${el.tagName.toLowerCase()}#${el.id || "-"}[${label}]`;
  });

test("the first Tab offers a way past the header @engine @tab-order", async ({ page }) => {
  await page.goto("/");

  // Tab until focus is on *something*, capped low. A freshly loaded page has
  // focus on the document rather than on an element, and the first Tab is
  // spent entering it — so a single press asserts nothing and two presses
  // would quietly pass even if the skip link were second. The guarantee being
  // checked is "the first element to receive focus is the skip link", and
  // this is that sentence rather than a fixed number of key presses.
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    const landed = await page.evaluate(() => document.activeElement !== document.body);
    if (landed) break;
  }

  const skip = page.locator("a[href='#main']");
  await expect(skip, "no skip link took the first tab stop").toBeFocused();

  // Visible once focused, not merely present — a sighted keyboard user
  // otherwise lands on a control that is not on screen.
  await expect(skip).toBeInViewport();

  await page.keyboard.press("Enter");
  expect(await active(page), "activating the skip link did not move focus to main").toContain("main");
});

test("focus moves into the menu, is held there, and comes back @engine @tab-order", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const trigger = page.getByRole("button", { name: /menu|მენიუ/i }).first();
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Focus went in.
  const insideAtOpen = await page.evaluate(() => {
    // `closest` matches the element itself, so an earlier version of this
    // asked whether the panel contained focus and missed the container
    // entirely — which is where the scrim lives.
    const container = document.querySelector('[role="dialog"]')?.parentElement;
    return container?.contains(document.activeElement) ?? false;
  });
  expect(insideAtOpen, "opening the drawer left focus out on the page behind it").toBe(true);

  // And stays in, all the way round the cycle. Twenty is comfortably more
  // stops than the drawer has, so a leak shows up rather than being outrun.
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(() => {
      const container = document.querySelector('[role="dialog"]')?.parentElement;
      return container?.contains(document.activeElement) ?? false;
    });
    expect(stillInside, `Tab #${i + 1} escaped the drawer`).toBe(true);
  }

  // Escape closes it, and focus returns to the control that opened it rather
  // than to the top of the document.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger, "focus did not return to the button that opened the drawer").toBeFocused();
});

test("the drawer says what it is @engine", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: /menu|მენიუ/i }).first().click();

  // `role="dialog"` with no name announces as "dialog" and nothing more, which
  // is worse than leaving the role off.
  const name = await page.getByRole("dialog").getAttribute("aria-label");
  expect(name?.trim(), "the drawer has no accessible name").toBeTruthy();
});

test("the catalogue filter drawer holds focus too @engine @tab-order", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/catalog");

  const trigger = page.getByRole("button", { name: /filters|ფილტრები/i }).first();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const container = document.querySelector('[role="dialog"]')?.parentElement;
      return container?.contains(document.activeElement) ?? false;
    });
    expect(inside, `Tab #${i + 1} escaped the filter drawer`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
