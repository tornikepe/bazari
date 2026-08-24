import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * Moving several orders at once.
 *
 * The interesting question is whether the database moved — a toolbar that
 * lights up and changes nothing is exactly the failure worth guarding against —
 * so this moves real orders and puts them back, one at a time, through the
 * per-row control that is the only way back to `pending`.
 *
 * `confirmed` is the target on purpose. It is the one transition with no side
 * effects to clean up: shipping mails the customer, delivering marks the money
 * taken, and cancelling returns stock to the catalogue and writes a ledger row
 * per line. Those are all worth having and none of them belong in a test that
 * shares its database with the rest of the suite.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

const rows = (page: Page) => page.locator("main table tbody tr");
const bar = (page: Page) => page.getByText(/\d+ selected/);

/** Ticks the first `count` rows and reports which orders they were. */
async function selectOrders(page: Page, count: number): Promise<string[]> {
  const numbers: string[] = [];

  for (let index = 0; index < count; index++) {
    const row = rows(page).nth(index);
    numbers.push((await row.locator('a[href^="/dashboard/orders/"]').first().innerText()).trim());
    await row.locator('input[name="order-id"]').check();
  }

  /* The bar counting them is the proof React saw the ticks. Without it a test
     can tick boxes before hydration, act on an empty selection, and fail
     several steps later on something unrelated — which is how the products
     version of this read on CI, where hydration lands later than it does here. */
  await expect(bar(page)).toHaveText(new RegExp(`${count} selected`));

  return numbers;
}

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/orders?status=pending");
});

test("nothing is offered until something is chosen @engine", async ({ page }) => {
  test.skip((await rows(page).count()) < 2, "needs two pending orders");

  await expect(bar(page)).toHaveCount(0);

  await selectOrders(page, 1);
  await expect(bar(page)).toHaveText(/1 selected/);

  // And the count is the count, not "some".
  await selectOrders(page, 2);
  await expect(bar(page)).toHaveText(/2 selected/);
});

test("select-all ticks every row, and clearing unticks them @engine", async ({ page }) => {
  /* Scoped to the table: the page renders both layouts and hides one with CSS,
     so every order has a checkbox in the card list as well. They carry the
     same value and are kept in step, but counting both counts each twice. */
  const boxes = page.locator('main table input[name="order-id"]');
  const total = await boxes.count();
  test.skip(total === 0, "needs at least one pending order");

  await page.getByRole("checkbox", { name: /select all/i }).check();
  await expect(bar(page)).toHaveText(new RegExp(`${total} selected`));

  await page.getByRole("button", { name: /clear the selection/i }).click();
  await expect(bar(page)).toHaveCount(0);

  // The boxes are server-rendered and uncontrolled, so this is the assertion
  // that catches a selection cleared in state while the ticks stayed on.
  for (let index = 0; index < total; index++) {
    await expect(boxes.nth(index), `row ${index} is still ticked`).not.toBeChecked();
  }
});

test("confirming two orders moves them, and they can be moved back @engine", async ({ page }) => {
  test.slow();
  test.skip((await rows(page).count()) < 2, "needs two pending orders");

  const chosen = await selectOrders(page, 2);

  await page.getByRole("button", { name: /^confirmed$/i }).click();

  /* Wait for the refresh the action starts rather than navigating on top of
     it: WebKit rejects a `goto` that interrupts a navigation already in
     flight, and the rows leaving this listing is the refresh finishing. */
  for (const number of chosen) {
    await expect(rows(page).filter({ hasText: number })).toHaveCount(0);
  }

  try {
    // Present in the confirmed listing rather than simply missing from this one.
    await page.goto("/dashboard/orders?status=confirmed");
    for (const number of chosen) {
      await expect(rows(page).filter({ hasText: number }).first()).toBeVisible();
    }
  } finally {
    // Back one at a time, through the row's own control — `pending` is
    // deliberately not offered in the bar, because undoing a dispatch for a
    // dozen orders at once is not something a toolbar should make easy.
    await page.goto("/dashboard/orders?status=confirmed");
    for (const number of chosen) {
      const row = rows(page).filter({ hasText: number }).first();
      await row.locator("select").selectOption("pending");
      await expect(rows(page).filter({ hasText: number })).toHaveCount(0);
    }
  }

  await page.goto("/dashboard/orders?status=pending");
  for (const number of chosen) {
    await expect(rows(page).filter({ hasText: number }).first()).toBeVisible();
  }
});

test("a selection already in that status says so rather than claiming work @engine", async ({
  page,
}) => {
  test.skip((await rows(page).count()) < 1, "needs a pending order");

  await page.goto("/dashboard/orders?status=confirmed");
  test.skip((await rows(page).count()) < 1, "needs a confirmed order");

  await selectOrders(page, 1);
  await page.getByRole("button", { name: /^confirmed$/i }).click();

  // Zero is a real answer, and it is not "done — 0 orders".
  await expect(page.getByRole("status").filter({ hasText: /nothing changed/i })).toBeVisible();
});

test("a viewer is not offered the selection at all @engine", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set in the environment");

  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/orders");

  // Read-only staff can look at this table and change nothing in it, so the
  // offer is not made. The server refuses as well; this is only the offer.
  await expect(page.locator('main input[name="order-id"]')).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /select all/i })).toHaveCount(0);
});
