import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * Acting on several products at once.
 *
 * The test publishes and unpublishes real rows and puts them back, because
 * the only interesting question is whether the database moved — a selection
 * that lights up a toolbar and changes nothing is exactly the failure worth
 * guarding against.
 *
 * Deleting is deliberately not exercised. It is the one irreversible action
 * here, it asks the browser for confirmation, and a test that answered that
 * dialog would be one mistake away from emptying the catalogue the rest of
 * the suite reads from.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

const rows = (page: Page) => page.locator("main table tbody tr");
const bar = (page: Page) => page.getByText(/\d+ selected/);

/** Ticks the first `count` rows and reports which products they were. */
async function selectRows(page: Page, count: number): Promise<string[]> {
  const names: string[] = [];

  for (let index = 0; index < count; index++) {
    const row = rows(page).nth(index);
    /* The product link, not the cell: the name cell also carries the brand
       and the "featured" flag on their own lines, and a multi-line string
       matches nothing when it is used to find the row again. */
    names.push(
      (await row.locator('a[href^="/dashboard/products/"]').first().innerText()).trim(),
    );
    await row.locator('input[name="product-id"]').check();
  }

  /* The bar counting them is the proof React saw the ticks. Without this the
     test can tick boxes before hydration, act on an empty selection, and fail
     several steps later on a missing confirmation — which is how it read on
     CI, where hydration lands later than it does here. */
  await expect(bar(page)).toHaveText(new RegExp(`${count} selected`));

  return names;
}

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  // Published only, so the rows start in a known state and the test can put
  // them back exactly as it found them.
  await page.goto("/dashboard/products?status=active");
});

test("nothing is offered until something is chosen @engine", async ({ page }) => {
  await expect(bar(page)).toHaveCount(0);

  await selectRows(page, 1);
  await expect(bar(page)).toHaveText(/1 selected/);

  // And the count is the count, not "some".
  await selectRows(page, 2);
  await expect(bar(page)).toHaveText(/2 selected/);
});

test("select-all ticks every row, and clearing unticks them @engine", async ({ page }) => {
  /* Scoped to the table: the page renders both layouts and hides one with
     CSS, so every product has a checkbox in the card list as well. They carry
     the same value and are kept in step, but counting both would count each
     product twice. */
  const boxes = page.locator('main table input[name="product-id"]');
  const total = await boxes.count();

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

test("hiding two products actually hides them, and publishing brings them back @engine", async ({
  page,
}) => {
  test.slow();
  const chosen = await selectRows(page, 2);

  await page.getByRole("button", { name: /^hide$/i }).click();
  await expect(page.getByText(/done — 2 products/i)).toBeVisible();

  /* Wait for the refresh the action starts, rather than navigating on top of
     it: WebKit rejects a `goto` that interrupts a navigation already in
     flight, and the rows leaving this listing is the refresh finishing. */
  for (const name of chosen) {
    await expect(rows(page).filter({ hasText: name })).toHaveCount(0);
  }

  try {
    // Gone from the published listing, which is the thing that was asked for.
    await page.goto("/dashboard/products?status=active");
    for (const name of chosen) {
      await expect(page.getByRole("cell", { name, exact: false })).toHaveCount(0);
    }

    // And present in the unpublished one rather than simply missing.
    await page.goto("/dashboard/products?status=inactive");
    for (const name of chosen) {
      await expect(page.getByRole("cell", { name, exact: false }).first()).toBeVisible();
    }
  } finally {
    await page.goto("/dashboard/products?status=inactive");
    for (const name of chosen) {
      await rows(page)
        .filter({ hasText: name })
        .locator('input[name="product-id"]')
        .first()
        .check();
    }
    await page.getByRole("button", { name: /^publish$/i }).click();
    await expect(page.getByText(/done — \d+ products/i)).toBeVisible();

    // Same wait, same reason: the rows leave the unpublished listing.
    for (const name of chosen) {
      await expect(rows(page).filter({ hasText: name })).toHaveCount(0);
    }
  }

  await page.goto("/dashboard/products?status=active");
  for (const name of chosen) {
    await expect(page.getByRole("cell", { name, exact: false }).first()).toBeVisible();
  }
});

test("a viewer is not offered the selection at all @engine", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set in the environment");

  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/products");

  // Read-only staff can look at this table and change nothing in it, so the
  // offer is not made. The server refuses as well; this is only the offer.
  await expect(page.locator('main input[name="product-id"]')).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /select all/i })).toHaveCount(0);
});
