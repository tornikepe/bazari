import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * Recording a delivery, and the ledger row it leaves.
 *
 * The number in the table can already be typed over; this is the other thing
 * that happens to stock, and the point of it is the ledger rather than the
 * arithmetic. So the assertion that matters is not that the figure went up —
 * it is that what explains the rise says `restock` and carries the note that
 * was typed, because "stock is now 40" does not answer "where did these come
 * from?" six months later.
 *
 * Everything is put back: this suite shares its catalogue with the checkout
 * tests, and a product left twelve units richer would quietly change what they
 * are able to buy.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

/** Opens the first published product's page and reports its id. */
async function openProduct(page: Page): Promise<string> {
  await page.goto("/dashboard/products?status=active");
  const link = page.locator('main table a[href^="/dashboard/products/"]').first();
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page.getByRole("button", { name: /^save$/i }).first()).toBeVisible();
  return href!.split("/").pop()!;
}

const stockField = (page: Page) => page.locator('input[name="stock"]');

test("a delivery is added to the shelf and explained in the ledger @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  const id = await openProduct(page);

  const before = Number(await stockField(page).inputValue());

  await page.getByRole("spinbutton", { name: /how many arrived/i }).fill("12");
  await page.getByRole("textbox", { name: /note — invoice, supplier/i }).fill("E2E delivery 4471");
  await page.getByRole("button", { name: /^restock$/i }).click();

  try {
    // It says what it did, with the new figure rather than "saved".
    await expect(page.getByRole("status")).toContainText(
      new RegExp(`added 12 — now ${before + 12}`, "i"),
    );

    await page.reload();
    await expect(stockField(page)).toHaveValue(String(before + 12));

    // And the row that explains it: a delivery, not a correction, with the note.
    const ledger = page.locator("table").filter({ hasText: /restock/i });
    await expect(ledger.getByText("+12").first()).toBeVisible();
    await expect(ledger.getByText("E2E delivery 4471").first()).toBeVisible();
  } finally {
    /* Put back through the table's own control, which writes a `correction` —
       the honest reason, since undoing a test is not a delivery going out. */
    await page.goto("/dashboard/products?status=active");
    const stock = page
      .locator("main table tbody tr")
      .first()
      .getByRole("button", { name: /change the stock of/i });
    await stock.click();
    const field = page.locator("main table tbody tr").first().getByRole("spinbutton");
    await field.fill(String(before));
    await field.press("Enter");

    /* Wait for the cell to say the old number before navigating. Leaving on
       top of the refresh the action starts cancels it, and the restore then
       only looks like it happened. */
    await expect(
      page.locator("main table tbody tr").first().getByRole("button", {
        name: /change the stock of/i,
      }),
    ).toHaveText(new RegExp(`^${before}$`));

    await page.goto(`/dashboard/products/${id}`);
    await expect(stockField(page)).toHaveValue(String(before));
  }
});

test("nothing is added for a quantity that is not one @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await openProduct(page);

  const before = Number(await stockField(page).inputValue());

  // The field itself refuses it — `min={1}` and `required` — so the form never
  // submits and the figure cannot move.
  await page.getByRole("spinbutton", { name: /how many arrived/i }).fill("0");
  await page.getByRole("button", { name: /^restock$/i }).click();

  await expect(page.getByRole("status")).toHaveCount(0);
  await page.reload();
  await expect(stockField(page)).toHaveValue(String(before));
});

test("a viewer is not offered it @engine", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set in the environment");

  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  const id = await openProduct(page);

  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto(`/dashboard/products/${id}`);

  // The ledger is theirs to read; adding to it is not.
  await expect(page.getByRole("button", { name: /^restock$/i })).toHaveCount(0);
  await expect(page.getByText(/stock movements/i).first()).toBeVisible();
});
