import { expect, test } from "@playwright/test";
import { DEMO_CUSTOMER, signIn, useEnglish } from "./helpers";

/**
 * The customer's own page.
 *
 * It used to open with "Hi, name" and nothing else, then three cards — one of
 * which was a link whose label and value were both the word "Wishlist" — and
 * a list of orders laid out with `flex-wrap`, so the totals landed at a
 * different x on every line.
 *
 * The assertions below are about the two things that were actually wrong: the
 * figures have to describe the same account rather than the same *page*, and
 * a column of money has to line up, because scanning it is the only thing the
 * list is for.
 */

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await page.goto("/account");
});

test("the page says who is signed in @engine", async ({ page }) => {
  // Name, address and the state of the account — none of which it showed.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/\S/);
  await expect(page.getByText(DEMO_CUSTOMER.email)).toBeVisible();
  await expect(page.getByText(/email (confirmed|not confirmed)/i)).toBeVisible();
});

test("the figures describe the account, not the page @engine", async ({ page }) => {
  const strip = page.locator("dl").first();
  await expect(strip.locator("dt")).toHaveCount(4);

  const orders = Number((await strip.locator("dd").first().innerText()).replace(/\D/g, ""));
  const rows = await page.locator("#orders li").count();

  // The list is capped; the count is not. Before, the total spent was summed
  // over the twenty rows drawn while the count came from the database, so the
  // strip could read "106 orders, ₾2,125 spent" — two true numbers about two
  // different things.
  expect(orders).toBeGreaterThanOrEqual(rows);

  if (orders > rows) {
    await expect(page.getByText(/showing the last/i)).toBeVisible();
  }
});

test("the totals line up in one column @engine", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/account");

  const prices = page.locator("#orders li p.tabular-nums");
  const count = await prices.count();
  test.skip(count < 2, "this account has no orders to line up");

  const rights = await prices.evaluateAll((nodes) =>
    nodes.map((node) => Math.round(node.getBoundingClientRect().right)),
  );

  // Every figure ends on the same pixel. Ragged money is what the old
  // `flex-wrap` row produced, and it cannot be scanned.
  expect(new Set(rights).size, `prices end at ${[...new Set(rights)].join(", ")}`).toBe(1);
});

test("an order row opens that order @engine", async ({ page }) => {
  const first = page.locator("#orders li a").first();
  const number = (await first.locator("p").first().innerText()).trim();
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/order/${number}`));
});

test("the order list can be filtered by status @engine", async ({ page }) => {
  const tabs = page.getByRole("navigation", { name: /status/i }).getByRole("link");
  const count = await tabs.count();
  test.skip(count < 2, "this account has orders in only one state");

  // The filter is in the address, so it can be linked to and the back button
  // behaves — that is the reason it is links rather than a `<select>`.
  const second = tabs.nth(1);
  const label = (await second.innerText()).trim().split(/\s+/)[0]!;
  await second.click();

  await expect(page).toHaveURL(/status=/);
  await expect(second).toHaveAttribute("aria-current", "page");

  // Every row shown is in the state that was asked for.
  const badges = await page.locator("#orders li .badge").allInnerTexts();
  expect(badges.length).toBeGreaterThan(0);
  for (const badge of badges) {
    expect(badge.trim().toLowerCase()).toBe(label.toLowerCase());
  }
});

test("a status nobody has is not offered @engine", async ({ page }) => {
  // A tab reading "cancelled 0" invites a click that leads to an empty page.
  const labels = await page
    .getByRole("navigation", { name: /status/i })
    .getByRole("link")
    .allInnerTexts();

  for (const label of labels) {
    const shown = Number(label.trim().split(/\s+/).pop());
    expect(shown, `${label} is offered with nothing behind it`).toBeGreaterThan(0);
  }
});
