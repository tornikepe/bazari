import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * The shop's settings.
 *
 * This is the page that decides whether anyone other than its author can use
 * the project: before it, the name, the delivery rules and the contact details
 * were constants in TypeScript.
 *
 * The tests below restore whatever they change, because this row is global —
 * a leftover shipping fee would follow every other test in the suite into the
 * cart.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

async function readField(page: Page, name: string) {
  return page.locator(`input[name="${name}"]`).inputValue();
}

async function save(page: Page) {
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByRole("status")).toBeVisible();
}

test("an admin can change the shop's name, and the site follows", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const original = await readField(page, "name");

  try {
    await page.locator('input[name="name"]').fill("Trial Shop");
    await save(page);

    // The header is the point. A settings page that saves a value nothing
    // reads is a form, not a feature.
    await page.goto("/");
    await expect(page.locator("header")).toContainText("Trial Shop");

    // And the tab title, which is built from the name plus its suffix.
    expect(await page.title()).toContain("Trial Shop");
  } finally {
    await page.goto("/dashboard/settings");
    await page.locator('input[name="name"]').fill(original);
    await save(page);
  }
});

test("delivery rules reach the cart", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const originalFee = await readField(page, "shippingFee");
  const originalThreshold = await readField(page, "freeShippingThreshold");

  try {
    // A threshold nothing in the catalogue can reach, so the fee is always
    // charged and the cart has to show it.
    await page.locator('input[name="shippingFee"]').fill("7.50");
    await page.locator('input[name="freeShippingThreshold"]').fill("99999");
    await save(page);

    await page.goto("/catalog");
    // The first card that can actually be bought, not the first card. Nothing
    // stops the catalogue opening on a product the checkout suite has sold
    // out, and an out-of-stock card's button says so instead of offering the
    // cart — so "the first article's last button" waited sixty seconds for a
    // control that was never going to be clickable, and the restore below then
    // had no time left to run.
    await page.getByRole("button", { name: /add to cart/i }).first().click();
    await page.goto("/cart");

    await expect(page.locator("aside")).toContainText("7.50");
  } finally {
    await page.goto("/dashboard/settings");
    await page.locator('input[name="shippingFee"]').fill(originalFee);
    await page.locator('input[name="freeShippingThreshold"]').fill(originalThreshold);
    await save(page);
  }
});

test("money is typed in lari and comes back in lari", async ({ page }) => {
  // The form shows lari, the column stores tetri, and the action multiplies.
  // A round trip is the cheapest way to catch that boundary being applied
  // twice or not at all — a fee saved as 1500 lari rather than 15 would look
  // fine on the way in.
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const original = await readField(page, "shippingFee");

  try {
    await page.locator('input[name="shippingFee"]').fill("12.34");
    await save(page);

    await page.reload();
    expect(await readField(page, "shippingFee")).toBe("12.34");
  } finally {
    await page.goto("/dashboard/settings");
    await page.locator('input[name="shippingFee"]').fill(original);
    await save(page);
  }
});

test("an empty contact field is not rendered at all", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const original = await readField(page, "contactPhone");

  try {
    await page.locator('input[name="contactPhone"]').fill("");
    await save(page);

    await page.goto("/contact");
    // Asserted on the `tel:` link rather than on the page text: the page has
    // an em dash in ordinary prose ("a demo project — there is no real support
    // desk"), so looking for a dash as a stand-in for "empty row" matches a
    // sentence and fails on correct code. It did.
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);

    await page.goto("/dashboard/settings");
    await page.locator('input[name="contactPhone"]').fill("+995 555 00 00 00");
    await save(page);

    await page.goto("/contact");
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(1);
    await expect(page.locator('a[href^="tel:"]')).toContainText("+995 555 00 00 00");
  } finally {
    await page.goto("/dashboard/settings");
    await page.locator('input[name="contactPhone"]').fill(original);
    await save(page);
  }
});

test("a viewer sees the settings and cannot save them", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set");

  await useEnglish(page);
  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/settings");

  // The values are readable — a viewer is allowed to know what the shop is
  // configured to do.
  await expect(page.locator('input[name="name"]')).toBeVisible();
  await expect(page.locator('input[name="name"]')).toBeDisabled();

  // And there is nothing to press.
  await expect(page.getByRole("button", { name: /^save$/i })).toHaveCount(0);
});
