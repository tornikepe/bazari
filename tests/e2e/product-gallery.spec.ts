import { expect, test, type Page } from "@playwright/test";
import { ADMIN, signIn, useEnglish } from "./helpers";

/**
 * The product gallery, with photos it puts there itself.
 *
 * Nothing in the seeded catalogue has a second photo — every product ships
 * with the same placeholder — so a test that only *looked* at a product page
 * would pass against a gallery that never renders. This one uploads two
 * pictures through the admin form, checks the storefront, and takes them away
 * again, which also exercises the two halves that have to agree: the form
 * writes a list, the page reads one.
 */

test.describe.configure({ mode: "serial" });

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

/**
 * Two 1×1 PNGs that differ in one byte.
 *
 * They have to differ: the server stores by content and hands back a URL per
 * image, and two identical uploads are one photo — which is correct, and would
 * quietly leave this test with a gallery of one.
 */
const PNG = (blue: number) =>
  Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753" +
      "de0000000c4944415408d763f8cf00000301010018dd8db00000000049454e44ae426082",
    "hex",
  ).fill(blue, 60, 61);

/**
 * Opens the first product in the admin table and reports which one it is.
 *
 * The slug comes back from the form rather than from the catalogue, because
 * the two lists are not the same list: the dashboard shows unpublished
 * products and orders them its own way, so "the first product" means two
 * different things in the two places. Taking it from the form guarantees the
 * page being checked is the product being edited.
 */
async function openFirstProductInAdmin(page: Page): Promise<string> {
  // `status=active` matters: the dashboard lists unpublished products too, and
  // the first row happens to be one. Its storefront page is a 404, so a test
  // that edited it would look exactly like a broken gallery.
  await page.goto("/dashboard/products?status=active");
  // The pencil in the row, named rather than positional.
  await page.getByRole("link", { name: /^(edit|რედაქტირება)$/i }).first().click();
  await expect(page.getByRole("button", { name: /save|შენახვა/i }).first()).toBeVisible();
  return page.locator('input[name="slug"]').inputValue();
}

/** Saves, and waits for the form to hand the reader back to the list. */
async function save(page: Page) {
  await page.getByRole("button", { name: /^(save|შენახვა)$/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/products(\?|$)/, { timeout: 20_000 });
}

test("a product with more than one photo gets a gallery @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  const slug = await openFirstProductInAdmin(page);

  // --- before: one photo, and so no gallery controls at all ---------------
  await page.goto(`/product/${slug}`);
  await expect(
    page.getByRole("tab"),
    "a single photo should not get a thumbnail strip",
  ).toHaveCount(0);

  // --- add two ------------------------------------------------------------
  await openFirstProductInAdmin(page);
  const chooser = page.locator('label:has-text("Add a photo") input[type="file"]');

  for (const [index, blue] of [17, 240].entries()) {
    await chooser.setInputFiles({ name: `photo-${index}.png`, mimeType: "image/png", buffer: PNG(blue) });
    // The upload happens on choosing the file, so the thumbnail appearing is
    // the signal that the server accepted it.
    await expect(page.getByRole("button", { name: new RegExp(`Remove photo ${index + 1}`) })).toBeVisible();
  }

  await save(page);

  try {
    // --- the storefront ---------------------------------------------------
    await page.goto(`/product/${slug}`);

    const tabs = page.getByRole("tab");
    await expect(tabs, "three photos should give three thumbnails").toHaveCount(3);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    const shown = () => page.locator('[role="tabpanel"] img').getAttribute("src");
    const first = await shown();

    // One tab stop for the whole strip, and arrows inside it — the point of
    // the tabs pattern here, since seven photos as seven buttons would sit
    // between the price and the buy button.
    await expect(tabs.nth(1)).toHaveAttribute("tabindex", "-1");

    await tabs.first().focus();
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(1), "the arrow key did not move focus").toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    expect(await shown(), "the shown photo did not change").not.toBe(first);

    // Wrapping, because a strip that stops at the end makes the reader guess
    // which end they are at.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(2), "the strip should wrap around").toBeFocused();
  } finally {
    // --- and take them away again ------------------------------------------
    await openFirstProductInAdmin(page);
    for (const label of [/Remove photo 2/, /Remove photo 1/]) {
      await page.getByRole("button", { name: label }).click();
    }
    await save(page);

    await page.goto(`/product/${slug}`);
    await expect(page.getByRole("tab"), "the test left photos behind").toHaveCount(0);
  }
});
