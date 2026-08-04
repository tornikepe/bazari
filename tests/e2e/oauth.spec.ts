import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * Social sign-in.
 *
 * The happy path cannot be driven here — it ends at Google, and a test that
 * stubs Google out is a test of the stub. What *can* be checked without
 * credentials is everything that has to hold when the flow does not go to
 * plan, which is where the security actually lives: an unconfigured provider,
 * a callback with no state, a callback with the wrong state, and an open
 * redirect through `next`.
 */

test.beforeEach(async ({ page }) => useEnglish(page));

test("a configured provider gets a button, an unconfigured one does not", async ({ page }) => {
  // The suite pins Google credentials and leaves Facebook unset, so one of
  // each is on screen at once. Drawing a button for a provider this deployment
  // cannot actually use — and failing only after a round trip to Google — is
  // what the check in `configuredProviders` exists to prevent.
  await page.goto("/login");

  await expect(page.getByRole("link", { name: /continue with google/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /continue with facebook/i })).toHaveCount(0);
});

test("an unconfigured provider redirects to sign-in instead of erroring", async ({ page }) => {
  const response = await page.goto("/api/auth/facebook");
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login/);
});

test("starting the flow sets the state and verifier cookies", async ({ page, context }) => {
  // Followed only as far as the redirect: `waitUntil: "commit"` stops before
  // the browser actually reaches accounts.google.com, which is somewhere a
  // test suite has no business going.
  await page.goto("/api/auth/google?next=%2Fcheckout", { waitUntil: "commit" }).catch(() => {});

  const names = (await context.cookies()).map((cookie) => cookie.name);
  expect(names).toContain("bz_oauth_state");
  expect(names).toContain("bz_oauth_verifier");

  const state = (await context.cookies()).find((c) => c.name === "bz_oauth_state");
  // Not readable by script, and not surviving a week.
  expect(state?.httpOnly).toBe(true);
  expect(state?.sameSite).toBe("Lax");
});

test("an unknown provider name is refused", async ({ page }) => {
  const response = await page.goto("/api/auth/myspace");
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login/);
});

test("a callback with no state is refused", async ({ page }) => {
  // The state cookie is what stops a crafted callback URL carrying somebody
  // else's authorization code from linking their identity to this session.
  await page.goto("/api/auth/google/callback?code=stolen&state=whatever");
  await expect(page).toHaveURL(/\/login\?error=/);
});

test("a callback with a mismatched state is refused", async ({ page }) => {
  await page.context().addCookies([
    { name: "bz_oauth_state", value: "the-real-state", url: "http://127.0.0.1:3100" },
    { name: "bz_oauth_verifier", value: "the-real-verifier", url: "http://127.0.0.1:3100" },
  ]);

  await page.goto("/api/auth/google/callback?code=stolen&state=not-the-real-state");
  await expect(page).toHaveURL(/\/login\?error=state/);

  // Signing in must not have happened.
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});

test("the failed callback clears the flow cookies behind it", async ({ page, context }) => {
  await context.addCookies([
    { name: "bz_oauth_state", value: "abc", url: "http://127.0.0.1:3100" },
    { name: "bz_oauth_verifier", value: "def", url: "http://127.0.0.1:3100" },
  ]);

  await page.goto("/api/auth/google/callback?code=x&state=wrong");

  // A state cookie left behind after a failure is exactly what state exists to
  // prevent — it would still be valid for the next crafted callback.
  const names = (await context.cookies()).map((cookie) => cookie.name);
  expect(names).not.toContain("bz_oauth_state");
  expect(names).not.toContain("bz_oauth_verifier");
});

test("`next` cannot be used to redirect off-site", async ({ page }) => {
  // Protocol-relative: browsers read `//evil.example` as another origin, so a
  // bare startsWith("/") check would let it through.
  for (const target of ["//evil.example", "https://evil.example", "javascript:alert(1)"]) {
    await page.goto(`/login?next=${encodeURIComponent(target)}`);
    // The page renders; what matters is the value did not survive into the form.
    const value = await page.locator('input[name="next"]').inputValue();
    expect(value, `${target} should not survive validation`).toBe("");
  }
});

test("a legitimate `next` does survive", async ({ page }) => {
  await page.goto("/login?next=%2Fcheckout");
  await expect(page.locator('input[name="next"]')).toHaveValue("/checkout");
});
