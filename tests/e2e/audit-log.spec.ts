import { expect, test } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * The audit log: a change made from the dashboard has a name, a time and a
 * before-and-after, and the read-only role can read them.
 *
 * The change is a price typed over from the product table, put back
 * afterwards for the same reason the inline-edit suite puts it back: the
 * catalogue is shared with the checkout tests.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

test("a price change is recorded with who, what and the figures", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  await page.goto("/dashboard/products?status=active");
  const row = page.locator("main table tbody tr").first();
  const name = (await row.locator('a[href^="/dashboard/products/"]').first().innerText()).trim();
  const price = row.getByRole("button", { name: new RegExp(`change the price of ${name}`, "i") });
  const before = (await price.innerText()).trim().replace(/[^\d.,]/g, "");

  await price.click();
  const field = row.getByRole("spinbutton", { name: /change the price/i });
  await field.fill("8.88");
  await field.press("Enter");
  await expect(row.getByText("8.88")).toBeVisible();

  try {
    await page.goto("/dashboard/audit?entity=product");
    const entry = page.locator("li.card").filter({ hasText: name }).first();
    await expect(entry).toContainText(ADMIN.email);
    await expect(entry).toContainText(/edited a product/i);
    await expect(entry).toContainText("8.88");
    await expect(entry.locator("dt")).toContainText("price");

    // The read-only role sees the log — it is a record, not a control.
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, VIEWER.email, VIEWER.password);
    await page.goto("/dashboard/audit");
    await expect(page.locator("li.card").filter({ hasText: name }).first()).toContainText("8.88");
  } finally {
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/products?status=active");
    const back = page
      .locator("main table tbody tr")
      .first()
      .getByRole("button", { name: new RegExp(`change the price of ${name}`, "i") });
    await back.click();
    const restore = page.locator("main table tbody tr").first().getByRole("spinbutton", { name: /change the price/i });
    await restore.fill(before.replace(",", "."));
    await restore.press("Enter");
    await expect(page.locator("main table tbody tr").first().getByText("8.88")).toHaveCount(0);
  }
});
