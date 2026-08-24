import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish, uniqueEmail } from "./helpers";

/**
 * Naming a dashboard listing so it can be come back to.
 *
 * A view is the query string the toolbar already produces, with a name on it.
 * So the question worth asking is not whether a row appears in a table — it is
 * whether pressing the chip puts the listing back the way it was, and whether
 * the shortcut is a *link*, which is what makes it something you can bookmark
 * or send to somebody.
 *
 * Every test deletes what it saved. The views are per-account and the demo
 * admin is shared with the rest of the suite, so one left behind would follow
 * every later run around.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

/** A name this run owns, so a leftover from an earlier one cannot be mistaken for it. */
const viewName = `E2E ${uniqueEmail("view").split("@")[0]}`.slice(0, 40);

const chip = (page: Page, name: string) => page.getByRole("link", { name, exact: true });

async function removeView(page: Page, name: string) {
  const remove = page.getByRole("button", { name: new RegExp(`delete the view ${name}`, "i") });
  if ((await remove.count()) > 0) {
    await remove.first().click();
    await expect(remove).toHaveCount(0);
  }
}

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
});

test("a filtered listing can be named, and the name puts it back @engine", async ({ page }) => {
  test.slow();
  await page.goto("/dashboard/orders?status=confirmed");

  await page.getByRole("button", { name: /save this view/i }).click();
  await page.getByRole("textbox", { name: /name for this view/i }).fill(viewName);
  await page.getByRole("button", { name: /^save this view$/i }).click();

  try {
    await expect(chip(page, viewName)).toBeVisible();

    // A link, not a button: this is the property that makes a view something
    // you can open in a new tab, bookmark, or send to somebody.
    await expect(chip(page, viewName)).toHaveAttribute(
      "href",
      /\/dashboard\/orders\?.*status=confirmed/,
    );

    // And it survives leaving the page, which is the whole point of saving it.
    await page.goto("/dashboard/orders");
    await expect(chip(page, viewName)).toBeVisible();

    await chip(page, viewName).click();
    await expect(page).toHaveURL(/status=confirmed/);
    // Marked as the one being read, so a row of chips says where you are.
    await expect(chip(page, viewName)).toHaveAttribute("aria-current", "true");
  } finally {
    await page.goto("/dashboard/orders");
    await removeView(page, viewName);
  }

  await page.goto("/dashboard/orders");
  await expect(chip(page, viewName)).toHaveCount(0);
});

test("the page number is not part of a view @engine", async ({ page }) => {
  test.slow();
  // Page two of an unfiltered listing: where the reader is standing, not what
  // they are looking at.
  await page.goto("/dashboard/products?status=active&page=2");

  await page.getByRole("button", { name: /save this view/i }).click();
  await page.getByRole("textbox", { name: /name for this view/i }).fill(viewName);
  await page.getByRole("button", { name: /^save this view$/i }).click();

  try {
    await expect(chip(page, viewName)).toBeVisible();
    await expect(chip(page, viewName)).toHaveAttribute("href", /status=active/);
    await expect(chip(page, viewName)).not.toHaveAttribute("href", /page=2/);
  } finally {
    await removeView(page, viewName);
  }
});

test("a viewer can save one too @engine", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set in the environment");

  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/orders?status=shipped");

  /* Read-only staff can change nothing about the shop, and a shortcut to a
     listing is not a change to the shop. They have the most use for one. */
  await page.getByRole("button", { name: /save this view/i }).click();
  await page.getByRole("textbox", { name: /name for this view/i }).fill(viewName);
  await page.getByRole("button", { name: /^save this view$/i }).click();

  try {
    await expect(chip(page, viewName)).toBeVisible();

    // And it is theirs: the admin's list does not grow a chip.
    await signIn(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/orders");
    await expect(chip(page, viewName)).toHaveCount(0);
  } finally {
    await signIn(page, VIEWER.email, VIEWER.password);
    await page.goto("/dashboard/orders");
    await removeView(page, viewName);
  }
});
