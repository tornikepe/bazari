import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * What the sign-in form says when something is missing.
 *
 * The fields used to carry `required` and nothing else, which hands the job to
 * the browser: a tooltip in the *browser's* language, in its own styling,
 * anchored where it likes, gone the moment anything is clicked. On a Georgian
 * shop it reads "Please fill out this field" in English.
 */

const alerts = (page: import("@playwright/test").Page) =>
  page.locator("#email-error, #password-error");

test("an empty form says which field, in the shop's language @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/login");

  await page.getByRole("button", { name: /sign in/i }).click();

  // Both complaints, and the page did not navigate.
  await expect(page.locator("#email-error")).toHaveText(/enter your email/i);
  await expect(page.locator("#password-error")).toHaveText(/enter your password/i);
  await expect(page).toHaveURL(/\/login/);
});

test("the complaint is tied to the field, not floating near it @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/login");
  await page.getByRole("button", { name: /sign in/i }).click();

  const email = page.locator("#email");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "email-error");

  // And the caret is put where the problem is rather than left where it was.
  await expect(email, "focus was not moved to the first field at fault").toBeFocused();
});

test("a missing password is named on its own @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/login");

  await page.locator("#email").fill("someone@example.test");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page.locator("#password-error")).toBeVisible();
  await expect(page.locator("#email-error")).toHaveCount(0);
  await expect(page.locator("#password"), "focus should move to the field at fault").toBeFocused();
});

test("an address with no @ is caught before the server @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/login");

  await page.locator("#email").fill("not-an-address");
  await page.locator("#password").fill("something");

  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });

  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.locator("#email-error")).toHaveText(/does not look like an email/i);
  expect(posts, "a plainly malformed address was still sent to the server").toEqual([]);
});

test("the complaint clears as soon as it is answered @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/login");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(alerts(page)).toHaveCount(2);

  await page.locator("#email").fill("someone@example.test");
  await expect(page.locator("#email-error"), "the error outlived the problem").toHaveCount(0);
  // The other one is still true, so it stays.
  await expect(page.locator("#password-error")).toBeVisible();
});

test("a correct form still reaches the server @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/login");

  await page.locator("#email").fill("nobody@example.test");
  await page.locator("#password").fill("wrongpassword");
  await page.getByRole("button", { name: /sign in/i }).click();

  // The server's answer, not the client's: the credentials are wrong, and the
  // form says so without revealing which half was.
  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert).toBeVisible();
  await expect(alerts(page), "client-side field errors fired on a well-formed form").toHaveCount(0);
});
