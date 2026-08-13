import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEMO_CUSTOMER, signIn, useEnglish } from "./helpers";

/**
 * Buying something without a mouse.
 *
 * Every step of this flow has its own test elsewhere, and all of them click.
 * Clicking proves the handler works; it proves nothing about whether the
 * control can be *reached*. A button hidden behind a focus trap, a control that
 * is a `<div>` with an `onClick`, a modal that opens with focus left on the page
 * behind it — each of those passes a clicking test and stops a keyboard user
 * dead.
 *
 * So this walks catalogue → product → cart → checkout → order using Tab and
 * Enter alone, and never calls `click()`.
 *
 * Chromium only, carrying `@tab-order`: Safari keeps links and buttons out of
 * the tab order unless the reader turns on full keyboard access, so there is
 * nothing to walk there. That is measured in `keyboard.spec.ts`, not assumed.
 */

test.skip(!DEMO_CUSTOMER.password, "CUSTOMER_PASSWORD is not set in the environment");

/**
 * Tabs until the element has focus, then reports how many presses it took.
 *
 * The count is the point as much as the reachability: "reachable in 200 tabs"
 * is not reachable in any sense a person would recognise, so the cap is low
 * enough to be a real statement about the page.
 */
async function tabTo(page: Page, target: Locator, budget = 40): Promise<number> {
  await expect(target, "the control is not on the page at all").toBeVisible();

  for (let presses = 1; presses <= budget; presses++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return presses;
  }

  throw new Error(`not reachable by keyboard within ${budget} tabs`);
}

/** Shift+Tab, for the same reason — a trap can hold in one direction only. */
async function tabBackTo(page: Page, target: Locator, budget = 40): Promise<number> {
  for (let presses = 1; presses <= budget; presses++) {
    await page.keyboard.press("Shift+Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return presses;
  }
  throw new Error(`not reachable backwards within ${budget} tabs`);
}

/**
 * Past the header and past the filters, the way a keyboard reader gets there:
 * the header's "skip to content", then the catalogue's "skip the filters".
 * Returns how many keys that took, because the count is the accessibility
 * claim — reachable in sixty presses is not reachable in any useful sense.
 */
async function skipToResults(page: Page): Promise<number> {
  let presses = await tabTo(page, page.locator('a[href="#main"]'), 4);
  await page.keyboard.press("Enter");
  presses += 1;

  presses += await tabTo(page, page.locator('a[href="#results"]'), 4);
  await page.keyboard.press("Enter");
  return presses + 1;
}

test("a product can be opened from the catalogue by keyboard @engine @tab-order", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await page.goto("/catalog");

  const firstCard = page.locator("article").first();
  const link = firstCard.locator('a[href^="/product/"]').first();
  const href = await link.getAttribute("href");

  // Sixty tabs was not enough when this was first written, and that number was
  // the finding: the filter rail is 63 stops deep, so the first product stood
  // 64 tab presses away on every catalogue page. Both skip links exist for
  // that, and this walks the route a keyboard reader actually takes.
  await skipToResults(page);

  await tabTo(page, link, 8);
  await page.keyboard.press("Enter");

  await expect(page, "Enter on a focused product link did not open it").toHaveURL(
    new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("the filters can be skipped in a handful of tabs @engine @tab-order", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/catalog");

  const presses = await skipToResults(page);

  // The number is the whole point: a bypass that is itself buried is not a
  // bypass. Four presses — skip to content, Enter, skip the filters, Enter.
  expect(presses, "getting past the filters is no longer a shortcut").toBeLessThanOrEqual(6);

  // Focus has to *move*, not merely scroll — otherwise the next Tab carries on
  // through the filter rail as though nothing had happened.
  const landed = await page.evaluate(() => document.activeElement?.id ?? "");
  expect(landed, "the skip link scrolled the page but left focus behind").toBe("results");

  // And from here the first product is a tab away, not sixty.
  const firstProduct = page.locator('a[href^="/product/"]').first();
  const after = await tabTo(page, firstProduct, 8);
  expect(after, "the results are still not close after skipping").toBeLessThanOrEqual(8);
});

test("a product can be put in the cart by keyboard @engine @tab-order", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await page.goto("/catalog");

  const product = await page.locator('a[href^="/product/"]').first().getAttribute("href");
  await page.goto(product!);

  const addButton = page.getByRole("button", { name: /add to cart/i }).first();
  await tabTo(page, addButton, 60);
  await page.keyboard.press("Enter");

  // The live region is the feedback a keyboard user actually gets, so that is
  // what is asserted rather than a header badge they cannot see.
  const status = page.locator('[role="status"]:not(#__next-route-announcer__)').first();
  await expect(status, "adding by keyboard announced nothing").toContainText(/added to the cart/i);
});

test("the whole purchase completes without a mouse @engine @tab-order", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  // Signing in is covered by its own tests; this one is about the buying.
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

  const product = await (async () => {
    await page.goto("/catalog");
    return page.locator('a[href^="/product/"]').first().getAttribute("href");
  })();

  await page.goto(product!);
  const addButton = page.getByRole("button", { name: /add to cart/i }).first();
  await tabTo(page, addButton, 60);
  await page.keyboard.press("Enter");

  // --- to the cart -------------------------------------------------------
  await page.goto("/cart");

  const checkout = page.getByRole("link", { name: /checkout|place order/i }).first();
  await tabTo(page, checkout, 60);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/checkout/);

  // --- fill the form -----------------------------------------------------
  // Typed rather than filled: `fill` sets a value directly and would not notice
  // a field that cannot be focused, which is exactly what this test is for.
  const fields: [RegExp, string][] = [
    [/full name/i, "Keyboard Only"],
    [/phone/i, "555000333"],
    [/city/i, "Tbilisi"],
    [/^address/i, "Rustaveli 7"],
  ];

  for (const [label, value] of fields) {
    const field = page.getByLabel(label).first();
    await tabTo(page, field, 60);
    await page.keyboard.type(value);
  }

  // --- and place it ------------------------------------------------------
  const place = page.getByRole("button", { name: /place order/i }).first();
  await tabTo(page, place, 40);
  await page.keyboard.press("Enter");

  await expect(page, "the order was not placed by keyboard").toHaveURL(/\/order\/BZ-/, {
    timeout: 30_000,
  });
});

test("the cart's quantity controls work from the keyboard @engine @tab-order", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await page.goto("/catalog");
  const product = await page.locator('a[href^="/product/"]').first().getAttribute("href");
  await page.goto(product!);

  const addButton = page.getByRole("button", { name: /add to cart/i }).first();
  await tabTo(page, addButton, 60);
  await page.keyboard.press("Enter");

  await page.goto("/cart");
  const quantity = page.locator('input[type="number"], input[inputmode="numeric"]').first();
  const increase = page.getByRole("button", { name: /\+|increase|more/i }).first();

  const before = Number(await quantity.inputValue());
  await tabTo(page, increase, 60);
  await page.keyboard.press("Enter");

  await expect
    .poll(async () => Number(await quantity.inputValue()), {
      message: "the quantity did not change when its control was activated by keyboard",
    })
    .toBe(before + 1);
});

test("nothing in the flow is a trap in either direction @engine @tab-order", async ({ page }) => {
  // A focus trap holds in one direction more often than in both, so the way
  // *back* out of a page is worth checking on its own. Tabbing forward to the
  // last control and then back to the first proves the cycle is open.
  test.slow();
  await useEnglish(page);
  await page.goto("/cart");

  const firstLink = page.locator("a[href='#main']");
  await tabTo(page, firstLink, 5);

  // Forward into the page, then back to where we started.
  for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
  const backwards = await tabBackTo(page, firstLink, 40);

  expect(backwards, "could not get back to the top of the page with Shift+Tab").toBeLessThanOrEqual(
    40,
  );
});
