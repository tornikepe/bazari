import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * Changing a price and a stock figure from the table.
 *
 * Both are put back, because this suite shares its catalogue with the checkout
 * tests — a product left at ₾1.00 would follow them around, and a stock figure
 * left at zero would make the next test's "add to cart" wait for a button that
 * says "out of stock".
 *
 * The stock half checks the ledger as well as the number. A figure that moves
 * with nothing to explain it is exactly what `StockMovement` exists to prevent,
 * and until this was written the dashboard was the one place that broke that
 * promise — typing a new stock into the product form changed the column and
 * left no trace at all.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

const rows = (page: Page) => page.locator("main table tbody tr");

/** The first row, and the name it belongs to. */
async function firstProduct(page: Page): Promise<{ row: ReturnType<typeof rows>; name: string }> {
  await page.goto("/dashboard/products?status=active");
  const row = rows(page).first();
  const name = (await row.locator('a[href^="/dashboard/products/"]').first().innerText()).trim();
  return { row, name };
}

test("a price can be typed over, and it is the price the shop uses @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  const { row, name } = await firstProduct(page);
  const price = row.getByRole("button", { name: new RegExp(`change the price of ${name}`, "i") });
  const before = (await price.innerText()).trim();

  await price.click();
  const field = row.getByRole("spinbutton", { name: new RegExp("change the price", "i") });
  await field.fill("7.77");
  await field.press("Enter");

  try {
    // The cell says so, once the refresh has landed.
    await expect(row.getByText("7.77")).toBeVisible();

    // And the product page says so, which is the only claim that matters.
    const href = await row.locator('a[href^="/dashboard/products/"]').first().getAttribute("href");
    const id = href!.split("/").pop()!;
    await page.goto(`/dashboard/products/${id}`);
    await expect(page.locator('input[name="price"]')).toHaveValue("7.77");
  } finally {
    await page.goto("/dashboard/products?status=active");
    const back = rows(page)
      .first()
      .getByRole("button", { name: new RegExp(`change the price of ${name}`, "i") });
    await back.click();
    const again = rows(page).first().getByRole("spinbutton");
    await again.fill(before.replace(/[^\d.]/g, ""));
    await again.press("Enter");
    await expect(rows(page).first().getByText(before)).toBeVisible();
  }
});

test("a stock figure leaves a ledger row behind @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  const { row, name } = await firstProduct(page);
  const href = await row.locator('a[href^="/dashboard/products/"]').first().getAttribute("href");
  const id = href!.split("/").pop()!;

  const stock = row.getByRole("button", { name: new RegExp(`change the stock of ${name}`, "i") });
  const before = Number((await stock.innerText()).replace(/\D/g, ""));

  await stock.click();
  const field = row.getByRole("spinbutton", { name: new RegExp("change the stock", "i") });
  await field.fill(String(before + 3));
  await field.press("Enter");

  try {
    await expect(
      rows(page).first().getByRole("button", { name: new RegExp(`change the stock of ${name}`, "i") }),
    ).toHaveText(new RegExp(`\\b${before + 3}\\b`));

    // The ledger on the product's own page explains the increase.
    await page.goto(`/dashboard/products/${id}`);
    const ledger = page.locator("table").filter({ hasText: /correction/i });
    await expect(ledger.getByText("+3").first()).toBeVisible();
  } finally {
    await page.goto("/dashboard/products?status=active");
    const back = rows(page)
      .first()
      .getByRole("button", { name: new RegExp(`change the stock of ${name}`, "i") });
    await back.click();
    const again = rows(page).first().getByRole("spinbutton");
    await again.fill(String(before));
    await again.press("Enter");
    await expect(
      rows(page).first().getByRole("button", { name: new RegExp(`change the stock of ${name}`, "i") }),
    ).toHaveText(new RegExp(`\\b${before}\\b`));
  }
});

test("escape puts the number back and changes nothing @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  const { row, name } = await firstProduct(page);
  const price = row.getByRole("button", { name: new RegExp(`change the price of ${name}`, "i") });
  const before = (await price.innerText()).trim();

  await price.click();
  const field = row.getByRole("spinbutton");
  await field.fill("1.23");
  await field.press("Escape");

  await expect(row.getByText(before)).toBeVisible();
  await expect(row.getByText("1.23")).toHaveCount(0);
});

test("a viewer gets the number and no way to type over it @engine", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set in the environment");

  await useEnglish(page);
  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/products?status=active");

  await expect(page.getByRole("button", { name: /change the price of/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /change the stock of/i })).toHaveCount(0);
  // The figures are still there — read-only is not blank.
  await expect(rows(page).first()).toContainText("₾");
});
