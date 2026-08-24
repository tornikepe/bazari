import { expect, test, type Page } from "@playwright/test";
import { ADMIN, signIn, useEnglish } from "./helpers";

/**
 * What an order looks like on paper.
 *
 * Printing is the one rendering of this site nobody ever sees while building
 * it, which is exactly why it rots: the masthead is hidden, and until this was
 * written it was taking the page's title with it, so every printed order came
 * out with no heading on it at all.
 *
 * `emulateMedia({ media: "print" })` is what makes this checkable. It applies
 * the print stylesheet to the live page, so the assertions below are about the
 * sheet of paper rather than about a class name being present in the markup.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

/** Opens the newest order in the dashboard and reports its number. */
async function newestOrder(page: Page): Promise<string> {
  await page.goto("/dashboard/orders");
  const link = page.locator('main table a[href^="/dashboard/orders/"]').first();
  const number = (await link.innerText()).trim();
  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(number);
  return number;
}

test("a printed order carries the shop, the number and the customer @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  const number = await newestOrder(page);

  const head = page.locator(".print-only");

  // On screen it is not there at all — this is for paper, and a second copy of
  // the shop's address above every order would be noise in the dashboard.
  await expect(head).toBeHidden();

  await page.emulateMedia({ media: "print" });

  try {
    await expect(head, "the invoice head is missing from the printed page").toBeVisible();

    // Who issued it, what it is, and who it is for.
    await expect(head).toContainText("Bazari");
    await expect(head).toContainText(number);
    await expect(head).toContainText(/invoice/i);
    await expect(head).toContainText(/bill to/i);

    // And that it is not pretending to be something it cannot be.
    await expect(head).toContainText(/not a fiscal document/i);
  } finally {
    await page.emulateMedia({ media: "screen" });
  }
});

test("the page keeps its heading and loses its chrome on paper @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await newestOrder(page);

  await page.emulateMedia({ media: "print" });

  try {
    /* The regression this exists for. The stylesheet hid every `<header>`,
       which was right while the only one was the masthead — and then the
       shared page title became a `<header>` too, and printed orders came out
       with no heading on them. */
    await expect(
      page.getByRole("heading", { level: 1 }),
      "the printed page lost its title",
    ).toBeVisible();

    // The parts that mean nothing on paper are gone: the rail's links, the
    // status dropdown, and the print button itself.
    await expect(page.locator(".admin-rail")).toBeHidden();
    await expect(page.getByRole("button", { name: /^print$/i })).toBeHidden();
    // Hidden rather than absent: the print stylesheet takes controls off the
    // page with `display`, it does not re-render it.
    await expect(page.locator("main select").first()).toBeHidden();

    // The document itself is still there.
    await expect(page.getByText(/^total$/i).first()).toBeVisible();
  } finally {
    await page.emulateMedia({ media: "screen" });
  }
});

test("the shop's own copy and the customer's are the same document @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  const number = await newestOrder(page);

  /* An admin may read any order's confirmation page — the same page a shopper
     lands on after paying — so the two renderings can be compared without
     placing an order. */
  await page.goto(`/order/${number}`);
  await expect(page.getByRole("button", { name: /^print$/i })).toBeVisible();

  await page.emulateMedia({ media: "print" });

  try {
    const head = page.locator(".print-only");
    await expect(head).toBeVisible();
    await expect(head).toContainText(number);
    await expect(head).toContainText(/bill to/i);
  } finally {
    await page.emulateMedia({ media: "screen" });
  }
});
