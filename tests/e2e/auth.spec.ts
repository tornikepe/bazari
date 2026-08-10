import { expect, test } from "@playwright/test";
import { uniqueEmail, useEnglish, clearRateLimits } from "./helpers";

test.beforeEach(async ({ page }) => useEnglish(page));

/**
 * The page's own alert, excluding the framework's.
 *
 * Next renders a `<div role="alert" id="__next-route-announcer__">` for screen
 * readers on every route. A document-wide `getByRole("alert")` matches it as
 * well as the real error and trips Playwright's strict mode — intermittently,
 * depending on whether the announcer had been populated yet.
 *
 * Excluding it by id rather than scoping to `main`: the auth pages are in
 * their own route group and have no `main` element at all.
 */
function pageAlert(page: import("@playwright/test").Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

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

  await expect(pageAlert(page)).toBeVisible();
  await expect(page).not.toHaveURL(/\/verify/);
});

test("mismatched passwords are caught before an account is made", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel(/full name/i).fill("E2E User");
  await page.getByLabel(/email/i).first().fill(uniqueEmail("mismatch"));
  await page.getByLabel(/^password/i).fill("e2epassword123");
  await page.getByLabel(/confirm/i).fill("somethingelse456");
  await page.getByRole("button", { name: /sign up|create/i }).click();

  await expect(pageAlert(page)).toBeVisible();
  await expect(page).not.toHaveURL(/\/verify/);
});

test("a password reset request never says whether the address exists", async ({ page }) => {
  // Both requests have to reach the endpoint for the comparison to mean
  // anything — a throttled second attempt renders "too many attempts" and
  // looks identical to a leak.
  await clearRateLimits();

  // Same response either way, or this endpoint enumerates the user list.
  const responses: string[] = [];

  for (const email of ["user@bazari.ge", uniqueEmail("ghost")]) {
    await page.goto("/forgot-password");
    await page.getByLabel(/email/i).first().fill(email);
    await page.getByRole("button", { name: /send code|კოდის გაგზავნა/i }).click();

    // Wait for the request to finish, not for a fixed number of milliseconds.
    // The old 1200ms was tuned to a faster database; against a remote one the
    // second request was still in flight when the page was read, so the
    // comparison caught a half-submitted form against a completed one and
    // reported it as an enumeration leak. A security test that fails for a
    // timing reason is worse than no test — the honest reading of a red one
    // is to believe it.
    await expect(page.getByRole("button", { name: /sending|იგზავნება/i })).toHaveCount(0, {
      timeout: 20_000,
    });

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
