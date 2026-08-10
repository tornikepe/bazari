import { expect, test, type Page } from "@playwright/test";
import { ADMIN, signIn, useEnglish } from "./helpers";

/**
 * Setting the shop's brand colour without touching the code.
 *
 * The unit tests prove the palette that comes out of a colour meets AA. They
 * cannot prove the palette reaches the page — that it survives the database,
 * the render, and the cascade against a stylesheet that declares the same
 * custom properties. That is what this checks, by reading the colours the
 * browser actually computed.
 *
 * Every test restores the original colour: the settings row is global, and a
 * shop left blue would follow the rest of the suite around.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

const DEFAULT = "#dc1f24";

async function readBrandColor(page: Page) {
  return page.locator('input[name="brandColor"]').inputValue();
}

/** What the browser resolved a token to, on the live page. */
async function token(page: Page, name: string) {
  return page.evaluate(
    (property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
    `--color-${name}`,
  );
}

/** WCAG contrast between two computed colours, measured in the page. */
async function ratioOf(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;

    const luminance = (colour: string) => {
      const [r, g, b] = colour
        .match(/\d+(\.\d+)?/g)!
        .slice(0, 3)
        .map((n) => Number(n) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };

    const style = getComputedStyle(element);
    const [lighter, darker] = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
    return (lighter! + 0.05) / (darker! + 0.05);
  }, selector);
}

/** Next's route announcer is also `role="alert"`, so it is excluded by id. */
function brandAlert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

async function setColour(page: Page, hex: string) {
  await page.locator('input[name="brandColor"]').fill(hex);
}

async function save(page: Page) {
  await page.getByRole("button", { name: /^save$/i }).click();
}

/**
 * Waits for the form's own save confirmation.
 *
 * Worth a named helper because getting this wrong is invisible: an earlier
 * version waited on `role="status"` while the brand field also carried that
 * role for its contrast readout, so the wait matched a line that was already
 * on screen and returned before the save had happened. The test then read the
 * storefront too early and failed for a reason that had nothing to do with it.
 */
async function expectSaved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /saved/i })).toBeVisible();
}

test("an admin sets a brand colour and the storefront changes", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const original = await readBrandColor(page);

  try {
    await setColour(page, "#1877f2");
    await save(page);
    await expectSaved(page);

    await page.goto("/");

    // The tokens the whole site is drawn from, read off the document.
    const link = await token(page, "brand-600");
    const solid = await token(page, "brand-solid");

    expect(link).not.toBe(DEFAULT);
    expect(link).toMatch(/^#[0-9a-f]{6}$/);
    expect(solid).toMatch(/^#[0-9a-f]{6}$/);

    // A blue brand should be blue: more blue than red in the derived link shade.
    const [r, , b] = [1, 3, 5].map((i) => parseInt(link.slice(i, i + 2), 16));
    expect(b!).toBeGreaterThan(r!);
  } finally {
    await page.goto("/dashboard/settings");
    await setColour(page, original);
    await save(page);
  }
});

test("the derived palette still meets AA where it lands on the page", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const original = await readBrandColor(page);

  try {
    // A green, because green carries the most luminance and is the hue most
    // likely to leave white button text unreadable.
    await setColour(page, "#158f4a");
    await save(page);
    await expectSaved(page);

    await page.goto("/");
    const ratio = await ratioOf(page, ".btn-primary");

    expect(ratio, "the primary button's own text on its own background").not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(4.5);
  } finally {
    await page.goto("/dashboard/settings");
    await setColour(page, original);
    await save(page);
  }
});

test("a colour that cannot be made readable is refused, and the shop keeps the old one", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const original = await readBrandColor(page);

  // Recorded before the attempt, so "nothing changed" is measured rather than
  // assumed from whatever the row happened to hold.
  await page.goto("/");
  const before = await token(page, "brand-600");
  await page.goto("/dashboard/settings");

  // A bright yellow: as link text on a near-white page it cannot reach AA
  // without becoming a dark olive, which is not the colour anyone picked.
  await setColour(page, "#ffd400");

  // The refusal is shown before saving — the form runs the same check the
  // action does, so the answer arrives while the colour is still on screen.
  await expect(brandAlert(page)).toBeVisible();

  await save(page);

  // And the save really did not go through, in the database or on the page.
  await page.goto("/");
  expect(await token(page, "brand-600")).toBe(before);

  await page.goto("/dashboard/settings");
  expect(await readBrandColor(page)).toBe(original);
});

test("the refusal offers a colour that is accepted", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const original = await readBrandColor(page);

  try {
    await setColour(page, "#ffd400");

    // Advice you can act on: the button carries the colour it suggests.
    const suggestion = page.getByRole("button", { name: /use #[0-9a-f]{6}/i });
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    // Taking the suggestion clears the complaint.
    await expect(brandAlert(page)).toHaveCount(0);

    await save(page);
    await expectSaved(page);
  } finally {
    await page.goto("/dashboard/settings");
    await setColour(page, original);
    await save(page);
  }
});

test("the default colour ships no override at all", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  // Set explicitly rather than assumed: the suite shares one settings row, and
  // this asserts the *absence* of an element, which is exactly the assertion a
  // leftover colour from another test would turn green-to-red at random.
  await page.goto("/dashboard/settings");
  await setColour(page, DEFAULT);
  await save(page);
  await expectSaved(page);

  await page.goto("/");

  // A shop on the default renders from the stylesheet alone — no extra
  // element, and nothing that can go stale against it.
  const injected = await page.evaluate(() =>
    [...document.querySelectorAll("head style")].filter((element) =>
      (element.textContent ?? "").includes("--color-brand"),
    ).length,
  );

  expect(injected).toBe(0);
});
