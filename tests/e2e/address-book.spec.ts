import { expect, test, type Page } from "@playwright/test";
import { DEMO_CUSTOMER, seedCart, signIn, useEnglish } from "./helpers";

/**
 * The address book, and the two places it has to show up.
 *
 * One address on the account was enough for a customer who orders to one
 * place and useless for everyone else: a present going to a parent meant
 * retyping a street every time. The book is only worth anything if checkout
 * offers it, so this walks both.
 *
 * It cleans up after itself — these rows belong to the demo customer that the
 * rest of the suite signs in as.
 */

test.describe.configure({ mode: "serial" });
test.skip(!DEMO_CUSTOMER.password, "CUSTOMER_PASSWORD is not set in the environment");

const HOME = { label: "E2E home", fullName: "Home Person", phone: "555000101", city: "Tbilisi", street: "Rustaveli 1" };
const WORK = { label: "E2E work", fullName: "Work Person", phone: "555000202", city: "Batumi", street: "Chavchavadze 9" };

const book = (page: Page) => page.locator("section").filter({ hasText: /^Addresses/ });

async function addAddress(page: Page, address: typeof HOME) {
  await page.goto("/account");
  await book(page).getByRole("button", { name: /add an address/i }).click();

  const form = book(page).locator("form");
  await form.getByLabel(/name it/i).fill(address.label);
  await form.getByLabel(/recipient/i).fill(address.fullName);
  await form.getByLabel(/^phone$/i).fill(address.phone);
  await form.getByLabel(/^city$/i).fill(address.city);
  await form.getByLabel(/^address$/i).fill(address.street);
  await form.getByRole("button", { name: /^save$/i }).click();

  /* The panel closes only after the action returns ok, so this separates the
     two ways saving can fail: a form still open means the submit never
     reached the server, and a form closed with no row means it did and the
     list did not catch up. Without the distinction a failure here is a
     fifteen-second timeout that says neither. */
  await expect(form, "the form stayed open — the submit never reached the action").toHaveCount(0);
  await expect(book(page).getByText(address.street)).toBeVisible();
}

async function removeAll(page: Page) {
  await page.goto("/account");

  for (const label of [HOME.label, WORK.label]) {
    const row = book(page).locator("li").filter({ hasText: label });
    if ((await row.count()) === 0) continue;

    /* `once`, immediately before the click that raises it. A handler added
       with `on` survives the call, so the second time this helper ran there
       were two of them: the first accepted the dialog and the second threw
       against a dialog already handled, which failed the run in CI and never
       here — locally the first call had nothing to delete and no dialog ever
       appeared. */
    page.once("dialog", (dialog) => void dialog.accept());
    await row.getByRole("button", { name: /delete/i }).click();
    await expect(row).toHaveCount(0);
  }
}

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await useEnglish(page);
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await removeAll(page);
  await page.close();
});

test("an address can be saved, edited and removed @engine", async ({ page }) => {
  test.slow();
  await removeAll(page);
  await addAddress(page, HOME);

  // The first one saved becomes the default without being asked: a book of
  // one has an obvious answer.
  const row = book(page).locator("li").filter({ hasText: HOME.label });
  await expect(row.getByText(/^default$/i)).toBeVisible();

  // Editing keeps the row rather than adding a second.
  await row.getByRole("button", { name: /edit/i }).click();
  await book(page).locator("form").getByLabel(/^address$/i).fill("Rustaveli 2");
  await book(page).locator("form").getByRole("button", { name: /^save$/i }).click();

  await expect(book(page).getByText("Rustaveli 2")).toBeVisible();
  await expect(book(page).locator("li")).toHaveCount(1);
});

test("checkout offers the saved addresses and filling one changes the form @engine", async ({
  page,
}) => {
  test.slow();
  await removeAll(page);
  await addAddress(page, HOME);
  await addAddress(page, WORK);

  await seedCart(page);
  await page.goto("/checkout");

  // The default filled the form without anything being clicked.
  await expect(page.getByLabel(/full name/i)).toHaveValue(HOME.fullName);

  // Choosing the other one rewrites every field it owns.
  await page.getByRole("radio", { name: new RegExp(WORK.label) }).check();
  await expect(page.getByLabel(/full name/i)).toHaveValue(WORK.fullName);
  await expect(page.getByLabel(/city/i)).toHaveValue(WORK.city);
  await expect(page.getByLabel(/^address/i)).toHaveValue(WORK.street);

  // And editing a field lets go of the address, rather than leaving a radio
  // lit against something that is no longer what will be delivered to.
  await page.getByLabel(/^address/i).fill("Somewhere else 3");
  await expect(page.getByRole("radio", { name: new RegExp(WORK.label) })).not.toBeChecked();
});

test("one saved address is not offered as a choice @engine", async ({ page }) => {
  await removeAll(page);
  await addAddress(page, HOME);

  await seedCart(page);
  await page.goto("/checkout");

  // It has already been used to fill the fields; a picker with one option is
  // a control that can only reselect what is selected.
  await expect(page.getByRole("radio", { name: new RegExp(HOME.label) })).toHaveCount(0);
  await expect(page.getByLabel(/full name/i)).toHaveValue(HOME.fullName);
});
