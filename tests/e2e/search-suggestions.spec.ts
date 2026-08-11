import { expect, test } from "@playwright/test";

/**
 * The header search shows what it found, in the header.
 *
 * The suggestion endpoint shares its matching predicate with the catalogue, so
 * the property worth guarding is not "a dropdown appears" but "what it offers
 * is what pressing enter would have found". Two definitions of *matches* fail
 * quietly and in the most annoying way available: a product listed here and
 * absent from the results page.
 */

const desktopSearch = (page: import("@playwright/test").Page) =>
  page.locator('form[role="search"] input[type="search"]').first();

/**
 * Types into the search field and waits for the value to actually stay there.
 *
 * The field is a controlled input, so filling it before React has hydrated sets
 * a value the first client render immediately throws away — the component
 * re-renders from empty state and the box is blank again. WebKit hydrates
 * slightly later than Chromium, which is the whole reason this was a one-engine
 * failure: the same test passed in Chromium purely on timing.
 *
 * Retrying until the value sticks is the honest fix. Waiting a fixed number of
 * milliseconds would pass on this machine and fail on a slower one.
 */
async function typeSearch(page: import("@playwright/test").Page, text: string) {
  const input = desktopSearch(page);
  await expect(input).toBeVisible();

  await expect
    .poll(
      async () => {
        await input.fill(text);
        return input.inputValue();
      },
      { message: `the search field would not hold "${text}" — hydration may not have finished` },
    )
    .toBe(text);

  return input;
}

test("typing a product name offers it in the field @engine", async ({ page }) => {
  await page.goto("/");

  // A brand the seed definitely carries, taken from the catalogue rather than
  // hardcoded, so the test does not depend on which products exist.
  await page.goto("/catalog");
  const firstName = (await page.locator("article h3, article h2").first().innerText()).trim();
  const term = firstName.split(/\s+/)[0]!;

  await page.goto("/");
  await typeSearch(page, term);

  const list = page.getByRole("listbox");
  await expect(list, `nothing was suggested for "${term}"`).toBeVisible();
  await expect(list.getByRole("option").first()).toBeVisible();
});

test("what it offers is what the catalogue finds @engine", async ({ page }) => {
  await page.goto("/catalog");
  const firstName = (await page.locator("article h3, article h2").first().innerText()).trim();
  const term = firstName.split(/\s+/)[0]!;

  await page.goto("/");
  await typeSearch(page, term);
  await expect(page.getByRole("listbox")).toBeVisible();

  const suggested = await page.getByRole("option").first().locator("a, span").allInnerTexts();
  const href = await page.getByRole("option").first().locator("a").getAttribute("href");
  expect(href, "a suggestion with no destination").toMatch(/^\/product\//);

  // The same word, through the catalogue. The suggested product has to be
  // among the results — not merely "some results exist".
  await page.goto(`/catalog?q=${encodeURIComponent(term)}`);
  const links = await page.locator(`a[href="${href}"]`).count();
  expect(links, `${href} was suggested but the catalogue does not return it for "${term}"`).toBeGreaterThan(0);
  void suggested;
});

test("the list is a combobox, not a decoration @engine", async ({ page }) => {
  await page.goto("/catalog");
  const term = (await page.locator("article h3, article h2").first().innerText()).trim().split(/\s+/)[0]!;

  await page.goto("/");
  const input = await typeSearch(page, term);
  await expect(page.getByRole("listbox")).toBeVisible();

  await expect(input).toHaveAttribute("role", "combobox");
  await expect(input).toHaveAttribute("aria-expanded", "true");

  // Arrow keys move the highlight without taking the caret out of the input,
  // which is what `aria-activedescendant` is for.
  await input.press("ArrowDown");
  await expect(input).toHaveAttribute("aria-activedescendant", /.+/);
  await expect(input, "the caret left the input").toBeFocused();

  const first = page.getByRole("option").first();
  await expect(first).toHaveAttribute("aria-selected", "true");
});

test("Escape closes the list and keeps the word @engine", async ({ page }) => {
  await page.goto("/catalog");
  const term = (await page.locator("article h3, article h2").first().innerText()).trim().split(/\s+/)[0]!;

  await page.goto("/");
  const input = await typeSearch(page, term);
  await expect(page.getByRole("listbox")).toBeVisible();

  await input.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(input, "Escape threw away what was typed").toHaveValue(term);
});

test("a query too short to mean anything asks for nothing @engine", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/search")) calls.push(request.url());
  });

  await page.goto("/");
  await typeSearch(page, "a");
  await page.waitForTimeout(600);

  expect(calls, "a single character queried the server").toEqual([]);
  await expect(page.getByRole("listbox")).toBeHidden();
});

test("a search that matches nothing offers nothing @engine", async ({ page }) => {
  await page.goto("/");
  await typeSearch(page, "zzzzqqqqxxxx");
  await page.waitForTimeout(700);

  await expect(page.getByRole("listbox")).toBeHidden();
  // And the form still works — suggestions are a shortcut, not the search.
  await desktopSearch(page).press("Enter");
  await expect(page).toHaveURL(/\/catalog\?q=zzzzqqqqxxxx/);
});
