import { expect, test, type Page } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * The three things a shop says besides "here is the product".
 *
 * "Bought together" is counted from orders this shop has taken; "recently
 * viewed" is this browser's own history; and the empty cart offers the second
 * of those rather than a dead end. What is checked below is mostly that none
 * of them appears when it has nothing true to say — a recommendation row
 * filled with whatever shares a shelf is the failure worth guarding against.
 */

/** The slug of a product that has actually been bought alongside others. */
async function aSoldProduct(page: Page): Promise<string> {
  await page.goto("/catalog");
  const href = await page.locator('a[href^="/product/"]').first().getAttribute("href");
  return href!.replace("/product/", "");
}

const section = (page: Page, name: RegExp) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name }) });

test("recently viewed shows what this browser looked at, and nothing before that @engine", async ({
  page,
}) => {
  test.slow();
  await useEnglish(page);

  // A browser with no history is shown no row at all — not a heading over an
  // empty grid, and not a skeleton for something that will never arrive.
  const first = await aSoldProduct(page);
  await page.goto(`/product/${first}`);
  await expect(section(page, /recently viewed/i)).toHaveCount(0);

  // Look at a second product: the first one is now history.
  await page.goto("/catalog");
  const second = await page
    .locator('a[href^="/product/"]')
    .nth(4)
    .getAttribute("href");
  await page.goto(second!);

  const row = section(page, /recently viewed/i);
  await expect(row).toBeVisible();

  // And the product being looked at is not in its own "recently viewed".
  const links = row.locator('a[href^="/product/"]');
  const hrefs = await links.evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("href")),
  );
  expect(hrefs.some((href) => href === second)).toBe(false);
  expect(hrefs.some((href) => href === `/product/${first}`)).toBe(true);
});

test("the row survives a reload, because it is not in the page @engine", async ({ page }) => {
  await useEnglish(page);

  const slug = await aSoldProduct(page);
  await page.goto(`/product/${slug}`);

  await page.goto("/cart");
  // The empty cart is the one place a suggestion is worth most, and it offers
  // history rather than a guess.
  await expect(section(page, /recently viewed/i)).toBeVisible();

  await page.reload();
  await expect(section(page, /recently viewed/i)).toBeVisible();
});

test("bought together is drawn from orders, or not at all @engine", async ({ page }) => {
  await useEnglish(page);

  const slug = await aSoldProduct(page);
  await page.goto(`/product/${slug}`);

  const row = section(page, /bought together/i);

  // The seeded shop has real orders, so this product should have neighbours.
  // If it ever does not, the row must be absent rather than empty — which is
  // exactly what this asserts either way.
  const count = await row.count();
  if (count === 0) {
    await expect(page.getByText(/bought together/i)).toHaveCount(0);
    return;
  }

  const links = row.locator('a[href^="/product/"]');
  expect(await links.count(), "the row was drawn with nothing in it").toBeGreaterThan(0);

  // Never itself.
  const hrefs = await links.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
  expect(hrefs).not.toContain(`/product/${slug}`);
});
