import { expect, test, type Page } from "@playwright/test";
import { ADMIN, signIn, useEnglish } from "./helpers";

/**
 * Specifications, written in the dashboard and read on the product page.
 *
 * Nothing in the seed has any, so a test that only looked at a product page
 * would pass against a table that never renders — the same trap the gallery
 * test was written around. This one types two rows into the form, reads them
 * back off the storefront in both languages, and takes them away again.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

const ROWS = [
  { labelKa: "წონა", labelEn: "Weight", valueKa: "1.2 კგ", valueEn: "1.2 kg" },
  { labelKa: "გარანტია", labelEn: "Warranty", valueKa: "24 თვე", valueEn: "24 months" },
];

async function openFirstProduct(page: Page): Promise<string> {
  // Published only: an unpublished product's storefront page is a 404, which
  // looks exactly like a specification table that failed to render.
  await page.goto("/dashboard/products?status=active");
  await page.getByRole("link", { name: /^(edit|რედაქტირება)$/i }).first().click();
  await expect(page.getByRole("button", { name: /save|შენახვა/i }).first()).toBeVisible();
  return page.locator('input[name="slug"]').inputValue();
}

async function save(page: Page) {
  await page.getByRole("button", { name: /^(save|შენახვა)$/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/products(\?|$)/, { timeout: 20_000 });
}

const rowCount = (page: Page) => page.locator('section:has(input[name="spec_labelEn"]) > ul > li');

test("a product with specifications shows them, and one without shows nothing @engine", async ({
  page,
}) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  const slug = await openFirstProduct(page);

  // --- before ------------------------------------------------------------
  await page.goto(`/product/${slug}`);
  await expect(
    page.getByRole("heading", { name: /^specifications$/i }),
    "an empty table should not be drawn at all",
  ).toHaveCount(0);

  // --- write two rows -----------------------------------------------------
  await openFirstProduct(page);

  for (const row of ROWS) {
    await page.getByRole("button", { name: /add a row/i }).click();
    const last = rowCount(page).last();
    for (const [field, value] of Object.entries(row)) {
      await last.locator(`input[name="spec_${field}"]`).fill(value);
    }
  }
  await save(page);

  try {
    // --- the storefront, in English ---------------------------------------
    await page.goto(`/product/${slug}`);
    const table = page.locator("dl").filter({ hasText: "Weight" }).first();

    await expect(page.getByRole("heading", { name: /^specifications$/i })).toBeVisible();
    await expect(table).toContainText("1.2 kg");
    await expect(table).toContainText("24 months");

    // The order they were typed in, which is the only order there is.
    const labels = await table.locator("dt").allInnerTexts();
    expect(labels.slice(0, 2)).toEqual(["Weight", "Warranty"]);

    // --- and in Georgian ---------------------------------------------------
    await page.context().addCookies([
      { name: "cm_locale", value: "ka", url: "http://127.0.0.1:3100" },
    ]);
    await page.goto(`/product/${slug}`);
    await expect(page.locator("dl").filter({ hasText: "წონა" }).first()).toContainText("1.2 კგ");
  } finally {
    await useEnglish(page);
    await openFirstProduct(page);
    // Removing from the end: taking the first row out re-indexes the labels
    // of the ones below it while the test is still reading them.
    for (let index = ROWS.length; index >= 1; index--) {
      await page.getByRole("button", { name: new RegExp(`Remove row ${index}`) }).click();
    }
    await save(page);

    await page.goto(`/product/${slug}`);
    await expect(
      page.getByRole("heading", { name: /^specifications$/i }),
      "the test left rows behind",
    ).toHaveCount(0);
  }
});
