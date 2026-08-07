import { expect, test, type BrowserContext } from "@playwright/test";
import { DEMO_CUSTOMER, bumpSessionVersion, signIn } from "./helpers";

/**
 * Sessions can be revoked.
 *
 * The session cookie is stateless and self-verifying, which is why a request
 * needs no session lookup and there is no session table. The cost is that a
 * cookie could not be withdrawn once issued: resetting a password left every
 * existing session working for its full seven days — including whoever's
 * access prompted the reset. `sessionVersion` is signed into the cookie and
 * compared against the column, so bumping the column ends them all.
 *
 * These bump the column directly rather than driving the reset form. The code
 * that form needs is emailed and deliberately never returned to the caller —
 * `mail.ts` exists to guarantee exactly that — and a test is not a good reason
 * to open a way to read it back. `resetPassword` calls `revokeSessions`, and
 * this is `revokeSessions` doing its job.
 */

test.skip(!DEMO_CUSTOMER.password, "CUSTOMER_PASSWORD is not set in the environment");

/** Whether this browser still has a working session. */
async function stillSignedIn(context: BrowserContext) {
  const page = await context.newPage();
  try {
    await page.goto("/account");
    return !page.url().includes("/login");
  } finally {
    await page.close();
  }
}

test("an ordinary session survives a page load", async ({ context, page }) => {
  // The control. Without it, every assertion below would also pass if sessions
  // were simply broken.
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  expect(await stillSignedIn(context)).toBe(true);
});

test("the cookie carries a version", async ({ context, page }) => {
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

  const cookie = (await context.cookies()).find((c) => c.name === "bz_session");
  expect(cookie, "no session cookie was set").toBeDefined();

  // userId . version . expiresAt . hmac
  const parts = cookie!.value.split(".");
  expect(parts).toHaveLength(4);
  expect(Number.isInteger(Number(parts[1]))).toBe(true);
});

test("editing the version into the cookie does not work", async ({ context, page }) => {
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  expect(await stillSignedIn(context)).toBe(true);

  const cookie = (await context.cookies()).find((c) => c.name === "bz_session")!;
  const [userId, version, expiresAt, signature] = cookie.value.split(".");

  // Raising the number without re-signing. The HMAC covers it, so this is
  // rejected by the signature rather than by the version comparison — which is
  // the point: a stale cookie cannot be edited into a current one.
  await context.addCookies([
    { ...cookie, value: `${userId}.${Number(version) + 1}.${expiresAt}.${signature}` },
  ]);

  expect(await stillSignedIn(context)).toBe(false);
});

test("revoking ends a session held in another browser", async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();

  try {
    // Two browsers, both signed in as the same person — the real shape of the
    // problem. One test that revokes and then checks its own cookie proves
    // nothing much: the browser doing a password reset is handed a fresh
    // session on the way out by design.
    await signIn(await first.newPage(), DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    await signIn(await second.newPage(), DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

    expect(await stillSignedIn(first), "first browser starts signed in").toBe(true);
    expect(await stillSignedIn(second), "second browser starts signed in").toBe(true);

    await bumpSessionVersion(DEMO_CUSTOMER.email);

    // Both, because neither cookie carries the new number. The browser that
    // triggered a real reset would be re-issued one; nothing else is.
    expect(await stillSignedIn(first), "first browser must be signed out").toBe(false);
    expect(await stillSignedIn(second), "second browser must be signed out").toBe(false);

    // And signing in again works, so revocation locks nobody out permanently.
    const back = await first.newPage();
    await signIn(back, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
    expect(await stillSignedIn(first), "signing in again should work").toBe(true);
  } finally {
    await first.close();
    await second.close();
  }
});
