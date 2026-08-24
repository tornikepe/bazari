import { expect, test, type Page } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, signIn, useEnglish } from "./helpers";

/**
 * A product sold in more than one form, from the shop stating it to the order
 * recording it.
 *
 * One long test on purpose. Variants are not a screen — they are an agreement
 * between six places: the editor generates the combinations, the product page
 * resolves a pair of buttons into one of them, the cart keeps two of the same
 * product apart, the checkout charges the combination's own price, the order
 * keeps its own copy of the label, and the stock comes off the combination
 * rather than off the product. Testing any one of those alone would prove
 * nothing about the agreement, which is the part that breaks.
 *
 * Everything is undone at the end. The product is one the rest of the suite
 * buys from, and leaving it in two sizes would change what every later test is
 * able to add to a cart.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password || !DEMO_CUSTOMER.password, "the demo passwords are not set");

/** Opens the first published product in the dashboard and reports what it is. */
async function openProduct(page: Page): Promise<{ id: string; slug: string; stock: number }> {
  await page.goto("/dashboard/products?status=active");
  const link = page.locator('main table a[href^="/dashboard/products/"]').first();
  const href = await link.getAttribute("href");
  await link.click();
  await expect(page.getByRole("button", { name: /^save$/i }).first()).toBeVisible();

  return {
    id: href!.split("/").pop()!,
    slug: await page.locator('input[name="slug"]').inputValue(),
    stock: Number(await page.locator('input[name="stock"]').inputValue()),
  };
}

/**
 * Puts the dashboard back within reach whichever account the body left behind.
 *
 * The test signs in as a shopper halfway through, and a cleanup that assumed
 * it was still an admin — or that cleared cookies on a context the run had
 * already torn down — reported its own failure instead of the body's.
 */
async function ensureAdmin(page: Page) {
  await page.goto("/dashboard/products");
  // `signIn` reads its labels in both languages, so no locale is set here —
  // and setting one would make ESLint read this helper as a React hook.
  if (/\/login/.test(page.url())) await signIn(page, ADMIN.email, ADMIN.password);
}

/**
 * Clears every question, which takes the combinations with it.
 *
 * Used at both ends: at the start so the test does not inherit whatever an
 * interrupted run left behind — combinations multiply, so a leftover question
 * does not merely add a row, it doubles the table — and at the end so it
 * leaves none of its own.
 *
 * The loop is bounded. `while (count > 0)` against a control that re-renders
 * is a loop that ends when it is right and never when it is not, and this
 * runs inside a `finally` where the page may already be going away.
 */
async function removeVariants(page: Page, id: string, stock: number | null) {
  await ensureAdmin(page);
  await page.goto(`/dashboard/products/${id}`);

  const remove = page.getByRole("button", { name: /remove the question/i });
  for (let guard = 0; guard < 5 && (await remove.count()) > 0; guard++) {
    await remove.first().click();
  }

  await page.getByRole("button", { name: /save the variants/i }).click();
  await expect(page.getByRole("status").filter({ hasText: /variants saved/i })).toBeVisible();

  /* Let the refresh the save starts finish before anybody navigates. WebKit
     rejects a `goto` that interrupts a navigation already in flight, and the
     save ends in `router.refresh()`. */
  await page.waitForLoadState("networkidle");

  if (stock === null) return;

  // And the single figure the product had before, since the sum replaced it.
  await page.reload();
  await page.locator('input[name="stock"]').fill(String(stock));
  await page.getByRole("button", { name: /^save$/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/products(\?|$)/, { timeout: 20_000 });
}

test("a product gains a size, and the size is what gets bought @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  const product = await openProduct(page);

  /* Start from nothing, whatever the last run left. Combinations multiply, so
     an inherited question does not add a row to the table — it doubles it. */
  await removeVariants(page, product.id, null);

  try {
    // --- the shop states it -------------------------------------------------
    await page.getByRole("button", { name: /add a question/i }).click();

    /* Scoped to the question just added rather than to the page. A product
       that already had one would otherwise make every one of these ambiguous —
       which is how a leftover from an interrupted run reads. */
    const question = page.locator("section").filter({ hasText: /sizes and colours/i }).last();
    await question.getByLabel(/question \(ka\)/i).last().fill("ზომა");
    await question.getByLabel(/question \(en\)/i).last().fill("Size");

    // The first answer's row is already there; the second is added.
    await question.getByLabel(/answer \(ka\)/i).last().fill("პატარა");
    await question.getByLabel(/answer \(en\)/i).last().fill("Small");

    await question.getByRole("button", { name: /add an answer/i }).last().click();
    await question.getByLabel(/answer \(ka\)/i).last().fill("დიდი");
    await question.getByLabel(/answer \(en\)/i).last().fill("Large");

    /* Two combinations appear without being asked for — that is the point of
       generating them. Scoped to the panel: the stock ledger further down the
       same page carries the variant label in its notes, so a page-wide row
       search finds every sale of a Large ever made. */
    const grid = question.locator("table");
    await expect(grid.getByRole("row").filter({ hasText: "Small" })).toHaveCount(1);
    await expect(grid.getByRole("row").filter({ hasText: "Large" })).toHaveCount(1);

    await page.getByRole("spinbutton", { name: /stock — small/i }).fill("4");
    await page.getByRole("spinbutton", { name: /stock — large/i }).fill("2");
    // Large costs more, which is the case a variant price exists for.
    await page.getByRole("spinbutton", { name: /price — large/i }).fill("77.70");

    await page.getByRole("button", { name: /save the variants/i }).click();
    await expect(page.getByRole("status").filter({ hasText: /variants saved/i })).toBeVisible();

    // The product's own figure is now the sum of what can be bought.
    await page.reload();
    await expect(page.locator('input[name="stock"]')).toHaveValue("6");

    // --- a shopper picks one -------------------------------------------------
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    await page.goto(`/product/${product.slug}`);

    // Nothing is chosen, so nothing is claimed about a price or a stock level.
    await expect(page.getByRole("status").filter({ hasText: /choose a variant/i })).toBeVisible();

    await page.getByRole("button", { name: "Large", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /chosen: large/i }),
      "picking a size did not resolve a combination",
    ).toBeVisible();

    // The variant's own price, not the product's.
    await expect(page.getByText("77.70").first()).toBeVisible();

    await page.getByRole("button", { name: /add to cart/i }).first().click();

    // --- the cart keeps them apart -------------------------------------------
    await page.goto("/cart");
    await expect(page.getByText("Large", { exact: false }).first()).toBeVisible();

    // --- and the order records which one --------------------------------------
    await page.goto("/checkout");
    await page.getByLabel(/full name/i).fill("E2E Variant");
    await page.getByLabel(/phone/i).fill("555111222");
    await page.getByLabel(/city/i).fill("Tbilisi");
    await page.getByLabel(/^address/i).fill("1 Test Street");
    await page.getByRole("button", { name: /place order/i }).click();

    await expect(page).toHaveURL(/\/order\//, { timeout: 30_000 });
    await expect(
      page.getByText("Large", { exact: false }).first(),
      "the order does not say which one was bought",
    ).toBeVisible();

    // --- the stock came off the combination ------------------------------------
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, ADMIN.email, ADMIN.password);
    await page.goto(`/dashboard/products/${product.id}`);

    await expect(
      page.getByRole("spinbutton", { name: /stock — large/i }),
      "the large one did not lose a unit",
    ).toHaveValue("1");
    await expect(
      page.getByRole("spinbutton", { name: /stock — small/i }),
      "the small one lost a unit it never sold",
    ).toHaveValue("4");
  } finally {
    await removeVariants(page, product.id, product.stock);
  }
});

test("a product with no questions is exactly what it was @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  const product = await openProduct(page);

  await page.goto(`/product/${product.slug}`);

  // No picker, no "choose a variant", and the button that was always there.
  await expect(page.getByRole("status").filter({ hasText: /choose a variant/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /add to cart/i }).first()).toBeVisible();
});
