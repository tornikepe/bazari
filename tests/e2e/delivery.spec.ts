import { expect, test, type Page } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * How an order leaves the shop, and what it costs.
 *
 * Two things the settings page decides: whether a shopper may collect in
 * person, and whether the courier's fee depends on where it goes. Both are
 * global, so every test below puts back what it changed — a zone left behind
 * would make every other checkout in the suite demand one.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

async function saveSettings(page: Page) {
  await page.getByRole("button", { name: /^save$/i }).first().click();
  await expect(page.getByRole("status")).toBeVisible();
}

async function fillAddress(page: Page) {
  await page.getByLabel(/full name/i).fill("E2E Delivery");
  await page.getByLabel(/phone/i).fill("555000777");
  await page.getByLabel(/city/i).fill("Tbilisi");
  await page.getByLabel(/^address/i).fill("Rustaveli 7");
}

test("the VAT inside a total is shown on the way in and recorded on the way out", async ({
  page,
}) => {
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await seedCart(page);

  // A note under the total, not a row of the breakdown: it is inside the
  // figure, not added to it.
  await page.goto("/cart");
  await expect(page.locator("aside")).toContainText(/including vat 18%/i);

  await page.goto("/checkout");
  await expect(page.locator("aside")).toContainText(/including vat 18%/i);
  await fillAddress(page);
  await page.getByRole("button", { name: /place order/i }).click();
  await expect(page).toHaveURL(/\/order\/BZ-/);

  // And on the receipt, from the columns the order was written with.
  await expect(page.getByText(/including vat 18%/i)).toBeVisible();
});

test("a delivery zone prices the courier, and the order remembers it", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  const zoneName = `E2E Zone ${Date.now()}`;

  // Drawn with a threshold nothing in the catalogue can reach, so the fee is
  // always charged and the totals have to show it.
  await page.getByRole("button", { name: /add a zone/i }).click();
  await page.locator('input[name="nameKa"]').fill(zoneName);
  await page.locator('input[name="nameEn"]').fill(zoneName);
  await page.locator('input[name="fee"]').fill("9.99");
  await page.locator('input[name="freeAbove"]').fill("99999");
  await page.locator('form:has(input[name="nameEn"]) button[type="submit"]').click();
  await expect(page.getByText(zoneName)).toBeVisible();

  try {
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    await seedCart(page);
    await page.goto("/checkout");
    await fillAddress(page);

    // The only zone is chosen already — one option is not a choice. Cleared
    // here, because with zones configured a courier order must name one.
    const picker = page.getByLabel(/delivery zone/i);
    await expect(picker).toContainText(zoneName);
    await picker.selectOption("");
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page.getByText(/choose where the courier/i)).toBeVisible();
    await expect(page).not.toHaveURL(/\/order\//);

    // By index rather than label: the option's text carries the fee as well.
    await picker.selectOption({ index: 1 });
    await expect(page.locator("aside")).toContainText("9.99");

    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/order\/BZ-/);

    // The zone's name, from the order's own columns.
    await expect(page.getByText(zoneName)).toBeVisible();
    await expect(page.getByText("9.99").first()).toBeVisible();
  } finally {
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/settings");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: new RegExp(`delete — ${zoneName}`, "i") }).click();
    await expect(page.getByText(zoneName)).toHaveCount(0);
  }
});

test("collection in person costs nothing and needs no address", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/settings");

  await page.locator('input[name="pickupEnabled"]').check();
  await page.locator('input[name="pickupAddress"]').fill("Chavchavadze 12, Tbilisi");
  await saveSettings(page);

  try {
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    await seedCart(page);
    await page.goto("/checkout");

    await page.getByLabel(/full name/i).fill("E2E Collector");
    await page.getByLabel(/phone/i).fill("555000888");
    await page.getByLabel(/collect in person/i).check();

    // Where to collect from, and nothing to pay for delivery.
    await expect(page.getByText("Chavchavadze 12, Tbilisi")).toBeVisible();
    await expect(page.locator("aside")).toContainText(/free/i);

    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/order\/BZ-/);
    await expect(page.getByText(/collect in person/i)).toBeVisible();
    await expect(page.getByText("Chavchavadze 12, Tbilisi")).toBeVisible();
  } finally {
    await page.context().clearCookies();
    await useEnglish(page);
    await signIn(page, ADMIN.email, ADMIN.password);
    await page.goto("/dashboard/settings");
    await page.locator('input[name="pickupEnabled"]').uncheck();
    await page.locator('input[name="pickupAddress"]').fill("");
    await saveSettings(page);
  }
});
