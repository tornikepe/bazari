import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * The footer's information pages, edited from the dashboard.
 *
 * Each test restores what it changed: these rows are global, and a page left
 * unpublished would disappear from the footer for every other test in the run.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

/** The editor renders all eight pages at once, so fields are keyed by slug. */
const field = (page: Page, slug: string, name: string) =>
  page.locator(`form:has(input[value="${slug}"]) [name="${name}"]`);

async function saveCard(page: Page, slug: string) {
  const form = page.locator(`form:has(input[value="${slug}"])`);
  await form.getByRole("button", { name: /^save$/i }).click();
  await expect(form.getByRole("status")).toBeVisible();
}

test("editing a page changes what the site serves", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/pages");

  const original = await field(page, "warranty", "introEn").inputValue();

  try {
    await field(page, "warranty", "introEn").fill("Edited by the test suite.");
    await saveCard(page, "warranty");

    await page.goto("/warranty");
    await expect(page.locator("main")).toContainText("Edited by the test suite.");
  } finally {
    await page.goto("/dashboard/pages");
    await field(page, "warranty", "introEn").fill(original);
    await saveCard(page, "warranty");
  }
});

test("`## ` starts a section", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/pages");

  const original = await field(page, "warranty", "bodyEn").inputValue();

  try {
    await field(page, "warranty", "bodyEn").fill("## Coverage\nTwelve months.\n\n## Excluded\nWear.");
    await saveCard(page, "warranty");

    await page.goto("/warranty");
    // Two headed sections, in order — that is the entire format.
    const headings = await page.locator("main h2").allInnerTexts();
    expect(headings).toEqual(["Coverage", "Excluded"]);
    await expect(page.locator("main")).toContainText("Twelve months.");
  } finally {
    await page.goto("/dashboard/pages");
    await field(page, "warranty", "bodyEn").fill(original);
    await saveCard(page, "warranty");
  }
});

test("the shipping figures come from settings, not from the text", async ({ page }) => {
  // The whole reason placeholders exist: this page once advertised free
  // delivery over ₾20,000 against a real rule of ₾200, because the figure had
  // been typed into the sentence.
  await useEnglish(page);
  await page.goto("/shipping");

  const body = await page.locator("main").innerText();
  expect(body, "the placeholder should have been resolved").not.toContain("{freeShipping}");
  expect(body).toMatch(/₾200\.00|₾200/);
});

test("an unpublished page leaves the footer", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  await page.goto("/");
  await expect(page.locator("footer").getByRole("link", { name: /warranty/i })).toHaveCount(1);

  await page.goto("/dashboard/pages");
  const toggle = field(page, "warranty", "isPublished");

  try {
    await toggle.uncheck();
    await saveCard(page, "warranty");

    await page.goto("/");
    // A link to a page the shop has withdrawn is worse than no link.
    await expect(page.locator("footer").getByRole("link", { name: /warranty/i })).toHaveCount(0);
  } finally {
    await page.goto("/dashboard/pages");
    await field(page, "warranty", "isPublished").check();
    await saveCard(page, "warranty");
  }
});

test("a viewer can read the pages and not save them", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set");

  await useEnglish(page);
  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/pages");

  await expect(field(page, "warranty", "titleEn")).toBeDisabled();
  await expect(page.getByRole("button", { name: /^save$/i })).toHaveCount(0);
});
