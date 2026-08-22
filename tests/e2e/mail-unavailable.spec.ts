import { expect, test } from "@playwright/test";
import { uniqueEmail, useEnglish } from "./helpers";

/**
 * What the shop says when it cannot send email.
 *
 * The e2e environment has no mail provider, which is the same state a fresh
 * deployment is in — and for a long time the pages told people to check an
 * inbox nothing had been sent to. A code that never arrives with no
 * explanation is the worst of both: the reader waits, then blames themselves.
 *
 * The rule under test is also a security one. "This shop cannot send email" is
 * safe to tell anybody; "nothing was sent to *you*" would answer a question
 * about who has an account here, which is why the check happens before the
 * address is looked up and says the same thing for an address that does not
 * exist.
 */

test("signing up says the code cannot arrive, rather than promising it @engine", async ({
  page,
}) => {
  await useEnglish(page);
  await page.goto("/register");

  await page.getByLabel(/full name/i).fill("Mail Unavailable");
  await page.getByLabel(/email/i).fill(uniqueEmail("nomail"));
  await page.getByLabel(/^password/i).fill("has-eight-plus");
  await page.getByLabel(/confirm/i).fill("has-eight-plus");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/verify\?/);

  const notice = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
  await expect(notice, "the page promised a code it could not send").toContainText(
    /not enabled|cannot arrive/i,
  );
  // And it says the account still works, because it does — the session was
  // created before the code was ever issued.
  await expect(notice).toContainText(/carry on|confirm the address later/i);

  // Asking again cannot help, so it is not offered as though it could.
  await expect(page.getByRole("button", { name: /send a new code/i })).toBeDisabled();
});

test("a password reset says the same thing, for any address @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/forgot-password");

  // Deliberately an address that does not exist: the answer must not differ
  // from the one a real account gets, or this page becomes a way to find out
  // who is registered.
  await page.getByLabel(/email/i).first().fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: /send|reset/i }).first().click();

  await expect(
    page.locator('[role="alert"]:not(#__next-route-announcer__)').first(),
  ).toContainText(/not enabled|cannot arrive/i);
});
