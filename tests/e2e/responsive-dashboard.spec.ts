import { expect, test } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, signIn } from "./helpers";

/**
 * The pages behind a sign-in, at phone widths.
 *
 * `responsive.spec.ts` sweeps the storefront and cannot reach these: every
 * one of them needs a session, and the dashboard is the part of this project
 * most likely to be opened on a phone by the person running the shop.
 *
 * The measurement is page-level overflow rather than every element's right
 * edge. A table wider than the screen inside its own scroller is correct and
 * intended; a *page* that can be dragged sideways is the fault, because it
 * takes the header, the footer and every other page with it.
 */

const ADMIN_PAGES = [
  "/dashboard",
  "/dashboard/products",
  "/dashboard/products/new",
  "/dashboard/orders",
  "/dashboard/customers",
  "/dashboard/categories",
  "/dashboard/pages",
  "/dashboard/settings",
];

const CUSTOMER_PAGES = ["/account", "/favorites"];

async function overflowOf(page: import("@playwright/test").Page, paths: string[]) {
  const spills: string[] = [];
  for (const path of paths) {
    await page.goto(path);
    // The widest thing on the page decides, so wait for it to be there.
    await page.waitForLoadState("domcontentloaded");
    const over = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    if (over > 0) spills.push(`${path} overflows by ${over}px`);
  }
  return spills;
}

for (const width of [320, 390]) {
  test(`the dashboard fits a ${width}px screen @engine`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, ADMIN.email, ADMIN.password);

    // Georgian, deliberately: it is the longer language, and every layout
    // fault this project has found at a small width appeared there first.
    expect(await overflowOf(page, ADMIN_PAGES)).toEqual([]);
  });

  test(`a customer's own pages fit a ${width}px screen @engine`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

    expect(await overflowOf(page, CUSTOMER_PAGES)).toEqual([]);
  });
}

test("the order tabs are big enough to press @engine", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/orders");

  // The row that narrows the list is the most-pressed control on this page
  // on a phone, and it was 30px tall.
  // Scoped to `main`: the sidebar has a link to the same page, and on a
  // phone it is in a drawer with no box to measure.
  const tab = page.locator('main a[href*="/dashboard/orders"]').first();
  await expect(tab).toBeVisible();
  const box = await tab.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
