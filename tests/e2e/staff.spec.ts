import { expect, test, type Page } from "@playwright/test";
import { ADMIN, VIEWER, signIn, uniqueEmail, useEnglish } from "./helpers";

/**
 * Who works here.
 *
 * Roles could only be changed in Prisma Studio. What matters about the page
 * that replaces it is not that it writes a column — it is the two ways a
 * dashboard can be locked from the inside, which is what most of this file
 * is about.
 */

test.describe.configure({ mode: "serial" });
test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

const invited = uniqueEmail("staff");

const rowFor = (page: Page, email: string) =>
  page.locator("li").filter({ hasText: email });

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/staff");
});

test("an invitation hands back a link, because nothing here can send one @engine", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^invite$/i }).click();
  await page.getByLabel(/email/i).fill(invited);
  await page.getByLabel(/^name$/i).fill("E2E Staff");
  await page.getByRole("button", { name: /^invite$/i }).click();

  // The link, not a promise that a message is on its way.
  const link = page.getByText(/\/invite\?token=/);
  await expect(link).toBeVisible();

  await expect(rowFor(page, invited)).toBeVisible();

  // The invited account cannot be signed into yet: it was created with a
  // password nobody knows, which is the point — no password is ever chosen
  // for somebody else.
  const token = (await link.innerText()).split("token=")[1]!.trim();
  expect(token.length).toBeGreaterThan(20);
});

test("your own account cannot be changed from here @engine", async ({ page }) => {
  const mine = rowFor(page, ADMIN.email);
  await expect(mine.getByText(/^you$/i)).toBeVisible();

  // Not disabled controls — no controls. Demoting yourself is one click from
  // being unable to undo it.
  await expect(mine.getByRole("combobox")).toHaveCount(0);
  await expect(mine.getByRole("button", { name: /turn off/i })).toHaveCount(0);
});

test("a viewer can read the list and change nothing @engine", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set in the environment");

  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/staff");

  await expect(page.getByRole("heading", { name: /staff/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^invite$/i })).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
});

test("an invited member sets their own password and lands in the dashboard @engine", async ({
  page,
}) => {
  test.slow();

  // A fresh invitation, so the token is this test's own.
  await page.getByRole("button", { name: /^invite$/i }).click();
  await page.getByLabel(/email/i).fill(invited);
  await page.getByRole("button", { name: /^invite$/i }).click();

  const url = (await page.getByText(/\/invite\?token=/).innerText()).trim();

  // Arriving as the invitee: signed out, holding nothing but the link.
  // Clearing cookies takes the language with it, so it is set again — this
  // test reads English labels.
  await page.context().clearCookies();
  await useEnglish(page);
  await page.goto(url);

  await page.getByLabel(/^password$/i).fill("staff-pass-1");
  await page.getByLabel(/confirm/i).fill("staff-pass-1");
  await page.getByRole("button", { name: /set the password/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  // And the link is spent: it works once, or it is a password reset anyone
  // who ever saw the URL can perform.
  await page.context().clearCookies();
  await useEnglish(page);
  await page.goto(url);
  await page.getByLabel(/^password$/i).fill("another-pass-1");
  await page.getByLabel(/confirm/i).fill("another-pass-1");
  await page.getByRole("button", { name: /set the password/i }).click();

  await expect(page.getByText(/expired or has already been used/i)).toBeVisible();
});

test("a switched-off account cannot sign in @engine", async ({ page }) => {
  test.slow();

  await rowFor(page, invited).getByRole("button", { name: /turn off/i }).click();
  await expect(rowFor(page, invited).getByText(/^off$/i)).toBeVisible();

  await page.context().clearCookies();
  await useEnglish(page);
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(invited);
  await page.getByLabel(/password/i).fill("staff-pass-1");
  await page.getByRole("button", { name: /sign in/i }).click();

  // The same message a wrong password gets: anything else turns the form into
  // a way to find out who works here.
  await expect(page.getByText(/email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
