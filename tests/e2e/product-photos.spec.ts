import { expect, test, type Page } from "@playwright/test";
import { ADMIN, signIn, useEnglish } from "./helpers";

/**
 * Photos that have an order and say what they show.
 *
 * Two things the shop could not do before. It could not promote a photo it
 * already had — the main one was a separate field, so making the second
 * picture the first meant deleting both and re-uploading them in the other
 * order. And it could not describe one: every product photo on the site was
 * announced as its position in the strip, which tells a listener nothing.
 *
 * The test uploads its own pictures, so it does not depend on a catalogue
 * where every product shares one placeholder — and takes them away again,
 * because it shares that catalogue with everything else in the suite.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

/** Two 1×1 PNGs that differ in one byte, so the server stores them separately. */
const PNG = (blue: number) =>
  Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753" +
      "de0000000c4944415408d763f8cf00000301010018dd8db00000000049454e44ae426082",
    "hex",
  ).fill(blue, 60, 61);

async function openFirstProduct(page: Page): Promise<string> {
  await page.goto("/dashboard/products?status=active");
  await page.getByRole("link", { name: /^(edit|რედაქტირება)$/i }).first().click();
  await expect(page.getByRole("button", { name: /^save$/i }).first()).toBeVisible();
  return page.locator('input[name="slug"]').inputValue();
}

async function save(page: Page) {
  await page.getByRole("button", { name: /^save$/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/products(\?|$)/, { timeout: 20_000 });
}

const urls = (page: Page) =>
  page.locator('input[name="photoUrl"]').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value),
  );

test("a photo can be moved to the front, and described @engine", async ({ page }) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  const slug = await openFirstProduct(page);
  const original = await urls(page);

  const chooser = page.locator('label:has-text("Add a photo") input[type="file"]');

  try {
    // --- two photos of our own ----------------------------------------------
    for (const [index, blue] of [33, 200].entries()) {
      await chooser.setInputFiles({
        name: `order-${index}.png`,
        mimeType: "image/png",
        buffer: PNG(blue),
      });
      await expect(page.locator('input[name="photoUrl"]')).toHaveCount(
        original.length + index + 1,
      );
    }

    const added = (await urls(page)).slice(original.length);
    expect(added).toHaveLength(2);

    // --- describe the last one, then promote it to the front ----------------
    const last = (await urls(page)).length;
    await page.getByLabel(`Description (en) — ${last}`).fill("A small blue square");
    await page.getByLabel(`Description (ka) — ${last}`).fill("პატარა ლურჯი კვადრატი");

    /* Up, as many times as it takes. There is no "make this the main photo"
       button because the first photo already is one — which is the thing being
       checked here. */
    for (let position = last; position > 1; position--) {
      await page.getByRole("button", { name: `Move photo ${position} up` }).click();
    }

    expect((await urls(page))[0], "the promoted photo is not first").toBe(added[1]);

    await save(page);

    // --- and the storefront agrees -------------------------------------------
    await page.goto(`/product/${slug}`);

    /* The description reaches the reader who needs it. Before this, the same
       image said "photo 1 of 3" — a position, not a description. */
    await expect(
      page.getByRole("img", { name: "A small blue square" }).first(),
      "the written description did not reach the page",
    ).toBeVisible();
  } finally {
    /* Put the product back exactly as it was found — by URL, not by position.
       The test promoted a photo to the front, so "everything after the
       original count" is no longer the set this test added.
       
       Each removal is waited for. Clicking returns before React has committed,
       and reading the list again straight away sees the row that was just
       removed — which is how an earlier version of this deleted the wrong
       photo and left the shop wearing a blue square. */
    await openFirstProduct(page);
    for (let guard = 0; guard < 10; guard++) {
      const current = await urls(page);
      const index = current.findIndex((url) => !original.includes(url));
      if (index < 0) break;

      await page.getByRole("button", { name: `Remove photo ${index + 1}` }).click();
      await expect(page.locator('input[name="photoUrl"]')).toHaveCount(current.length - 1);
    }
    await save(page);

    /* Read from the server rather than from the router's cache — the whole
       point of this check is that the save landed. */
    await openFirstProduct(page);
    await page.reload();
    await expect(page.getByRole("button", { name: /^save$/i }).first()).toBeVisible();
    expect(await urls(page), "the test left photos behind").toEqual(original);
  }
});

test("a photo with nothing written about it is announced by name @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  const slug = await openFirstProduct(page);
  const name = await page.locator('input[name="nameEn"]').inputValue();

  await page.goto(`/product/${slug}`);

  /* The fallback is the product's name, and it is the same whether the page
     draws one photo or a gallery — an undescribed picture of a power bank is
     still a picture of a power bank. */
  await expect(page.getByRole("img", { name }).first()).toBeVisible();
});
