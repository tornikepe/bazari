import { expect, test, type Page } from "@playwright/test";
import { ADMIN, signIn, uniqueEmail, useEnglish } from "./helpers";

/**
 * Asking to be told when something comes back, and being told.
 *
 * The interesting property is not the form — it is that the waiting list is
 * emptied by the thing that raises the stock, whichever of the four things
 * that was. So this takes a product to zero, leaves an address on it, puts the
 * stock back, and checks the row is gone: the message was sent and the address
 * was not kept, which is the promise the form makes in its own second line.
 *
 * No mail provider is configured in the suite, so the send is a line in the
 * server log. That is fine — what is being checked is that the list was
 * released, and a test that could only run with an API key would be a test
 * that never runs.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

const address = uniqueEmail("watch");

/** Sets the first published product's stock from the table, and reports its slug. */
async function setStock(page: Page, to: number): Promise<{ slug: string; id: string }> {
  await page.goto("/dashboard/products?status=active");
  const row = page.locator("main table tbody tr").first();
  const href = await row.locator('a[href^="/dashboard/products/"]').first().getAttribute("href");
  const id = href!.split("/").pop()!;

  await row.getByRole("button", { name: /change the stock of/i }).click();
  const field = row.getByRole("spinbutton");
  await field.fill(String(to));
  await field.press("Enter");

  await expect(
    page.locator("main table tbody tr").first().getByRole("button", {
      name: /change the stock of/i,
    }),
  ).toHaveText(new RegExp(`^${to}$`));

  await page.goto(`/dashboard/products/${id}`);
  const slug = await page.locator('input[name="slug"]').inputValue();
  return { slug, id };
}

test("a sold-out product takes an address, and gives it back when it returns @engine", async ({
  page,
}) => {
  test.slow();
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  const stock = await page.goto("/dashboard/products?status=active").then(async () => {
    const row = page.locator("main table tbody tr").first();
    return Number((await row.getByRole("button", { name: /change the stock of/i }).innerText()).trim());
  });

  const { slug } = await setStock(page, 0);

  try {
    // --- the shopper's half -------------------------------------------------
    await page.goto(`/product/${slug}`);
    await expect(page.getByRole("heading", { name: /tell me when it is back/i })).toBeVisible();

    await page.getByPlaceholder(/^email$/i).fill(address);
    await page.getByRole("button", { name: /^tell me$/i }).click();

    await expect(
      page.getByRole("status").filter({ hasText: /we will write the moment/i }),
    ).toBeVisible();

    // Asking twice is the same as asking once, and says so the same way — the
    // form must not become a way of finding out who is waiting for what.
    await page.reload();
    await page.getByPlaceholder(/^email$/i).fill(address);
    await page.getByRole("button", { name: /^tell me$/i }).click();
    await expect(
      page.getByRole("status").filter({ hasText: /we will write the moment/i }),
    ).toBeVisible();

    // --- and the shop's ------------------------------------------------------
    await setStock(page, stock > 0 ? stock : 5);

    // Back in stock, so the offer is withdrawn: there is nothing to wait for.
    await page.goto(`/product/${slug}`);
    await expect(page.getByRole("heading", { name: /tell me when it is back/i })).toHaveCount(0);
  } finally {
    await setStock(page, stock);
  }
});

test("a product that is in stock is not asking @engine", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);

  await page.goto("/dashboard/products?status=active");
  const row = page.locator("main table tbody tr").first();
  const href = await row.locator('a[href^="/dashboard/products/"]').first().getAttribute("href");
  await page.goto(href!);
  const slug = await page.locator('input[name="slug"]').inputValue();
  const stock = Number(await page.locator('input[name="stock"]').inputValue());
  test.skip(stock <= 0, "the first product is out of stock");

  await page.goto(`/product/${slug}`);
  await expect(page.getByRole("heading", { name: /tell me when it is back/i })).toHaveCount(0);
});
