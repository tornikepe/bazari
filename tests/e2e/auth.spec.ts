import { expect, test } from "@playwright/test";
import { uniqueEmail, useEnglish } from "./helpers";

test.beforeEach(async ({ page }) => useEnglish(page));

test("register → signed in → sign out", async ({ page }) => {
  const email = uniqueEmail("signup");

  await page.goto("/register");
  await page.getByLabel(/full name/i).fill("E2E User");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/^password/i).fill("e2epassword123");
  await page.getByLabel(/confirm/i).fill("e2epassword123");
  await page.getByRole("button", { name: /sign up|create/i }).click();

  // Signed in immediately, but asked to confirm the address.
  await expect(page).toHaveURL(/\/verify/);

  // The code must never travel in the URL — it would land in browser history,
  // access logs and the Referer header.
  expect(page.url()).not.toMatch(/[?&]code=/);

  await page.goto("/account");
  await expect(page).toHaveURL(/\/account/);

  await page.getByRole("button", { name: /my account/i }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  // `role="menuitem"` is set explicitly on the button, which overrides its
  // implicit button role — so this is a menuitem, not a button, to Playwright.
  await page.getByRole("menuitem", { name: /sign out/i }).click();

  // `logout` redirects to the home page; wait for that before checking that
  // the session is really gone, or the next navigation races the action.
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/$/);

  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});

test("signing up twice with the same address is refused", async ({ page }) => {
  const email = uniqueEmail("dupe");

  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/register");
    await page.getByLabel(/full name/i).fill("E2E User");
    await page.getByLabel(/email/i).first().fill(email);
    await page.getByLabel(/^password/i).fill("e2epassword123");
    await page.getByLabel(/confirm/i).fill("e2epassword123");
    await page.getByRole("button", { name: /sign up|create/i }).click();

    if (attempt === 0) await expect(page).toHaveURL(/\/verify/);
  }

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).not.toHaveURL(/\/verify/);
});

test("mismatched passwords are caught before an account is made", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel(/full name/i).fill("E2E User");
  await page.getByLabel(/email/i).first().fill(uniqueEmail("mismatch"));
  await page.getByLabel(/^password/i).fill("e2epassword123");
  await page.getByLabel(/confirm/i).fill("somethingelse456");
  await page.getByRole("button", { name: /sign up|create/i }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).not.toHaveURL(/\/verify/);
});

test("a password reset request never says whether the address exists", async ({ page }) => {
  // Same response either way, or this endpoint enumerates the user list.
  const responses: string[] = [];

  for (const email of ["user@bazari.ge", uniqueEmail("ghost")]) {
    await page.goto("/forgot-password");
    await page.getByLabel(/email/i).first().fill(email);
    await page.getByRole("button", { name: /send code|კოდის გაგზავნა/i }).click();
    await page.waitForTimeout(1200);
    responses.push(await page.locator("body").innerText());
  }

  expect(responses[0]).toBe(responses[1]);
});

test("the reset code is never returned to the browser", async ({ page }) => {
  const bodies: string[] = [];
  page.on("response", async (response) => {
    if (response.request().method() !== "POST") return;
    try { bodies.push(await response.text()); } catch { /* streamed */ }
  });

  await page.goto("/forgot-password");
  await page.getByLabel(/email/i).first().fill("user@bazari.ge");
  await page.getByRole("button", { name: /send code|კოდის გაგზავნა/i }).click();
  await page.waitForTimeout(1500);

  const all = bodies.join("\n");
  expect(all).not.toContain("demoCode");
  // A leaked code would show up as a bare six-digit run.
  expect(all).not.toMatch(/\b\d{6}\b/);
});
