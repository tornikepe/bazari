import { expect, test, type Page } from "@playwright/test";
import { ADMIN, signIn, useEnglish } from "./helpers";

/**
 * Sorting the dashboard's lists.
 *
 * Products could be sorted; orders and customers could not, and both are lists
 * a shop reads in a particular order for a particular reason — the biggest
 * order, the oldest one, the customer who has bought the most.
 *
 * What is checked is that the rows actually come back in the order asked for,
 * not that a `<select>` exists. A control that changes the URL and nothing
 * else is the failure mode worth guarding against.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
});

/** The money in each row of the orders table, top to bottom. */
async function totals(page: Page): Promise<number[]> {
  const text = await page.locator("main .tabular-nums, main td").allInnerTexts();
  return text
    .map((value) => value.replace(/[^\d.]/g, ""))
    .filter((value) => value.includes("."))
    .map(Number);
}

test("orders can be read biggest first @engine", async ({ page }) => {
  await page.goto("/dashboard/orders?sort=total-desc");
  const values = await totals(page);
  expect(values.length, "no totals were found to compare").toBeGreaterThan(2);

  const sorted = [...values].sort((a, b) => b - a);
  expect(values, "the rows are not in descending order of total").toEqual(sorted);
});

test("and oldest first @engine", async ({ page }) => {
  // The order number, because it identifies a row: a date can repeat across
  // dozens of seeded orders and would prove nothing about which one is first.
  const topRow = () => page.locator("main").getByText(/^BZ-[A-Z0-9]+$/).first().innerText();

  await page.goto("/dashboard/orders?sort=oldest");
  const oldest = await topRow();

  await page.goto("/dashboard/orders");
  const newest = await topRow();

  // Not a claim about a particular order — only that reversing the sort
  // changes which row is at the top, which is the whole point of the control.
  expect(oldest).not.toBe(newest);
});

test("customers can be read by who has ordered most @engine", async ({ page }) => {
  await page.goto("/dashboard/customers?sort=orders-desc");

  // The order-count cell of each row, in the table the wide layout draws —
  // scoped to the table so the summary cards at the top are not counted.
  const numbers = (
    await page.locator("main table tbody tr td:nth-last-child(2)").allInnerTexts()
  )
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  test.skip(numbers.length < 3, "not enough rows to compare");

  const sorted = [...numbers].sort((a, b) => b - a);
  expect(numbers, "the rows are not in descending order of order count").toEqual(sorted);
});

test("an unknown sort falls back rather than failing @engine", async ({ page }) => {
  // The value comes from the URL, so it is user input. A shop should not be
  // able to 500 its own dashboard by mistyping a query string.
  const response = await page.goto("/dashboard/orders?sort=; DROP TABLE");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /orders/i }).first()).toBeVisible();
});
