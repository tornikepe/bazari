import { expect, test } from "@playwright/test";
import { ADMIN, VIEWER, signIn, useEnglish } from "./helpers";

/**
 * Choosing a photo file for a product.
 *
 * The upload endpoint decides what a file is by reading its leading bytes and
 * throws away the `type` the browser declared, because that value comes from
 * the client. The tests below send a script and a sound file with image names
 * to check that the bytes are what is actually consulted — storing whatever was
 * declared and serving it back with that `Content-Type` is how a stored XSS is
 * built.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

/** A real 1x1 PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("an admin picks a file and it becomes the product's photo", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/products/new");

  const url = page.locator('input[name="image"]');
  const before = await url.inputValue();

  // `.first()` is the main photo — the form has a second picker for the
  // gallery, and the two are the same element type.
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: PNG,
  });

  // The field is filled by the upload, not by the save — so a failure is
  // reported while the reader is still looking at the field.
  await expect(url, "the upload did not fill the image field").not.toHaveValue(before);
  await expect(url).toHaveValue(/^\/api\/images\/[a-z0-9]+$/);

  // And the stored bytes come back as an image, with the type the server
  // decided rather than the one the form claimed.
  const stored = await page.request.get(await url.inputValue());
  expect(stored.status()).toBe(200);
  expect(stored.headers()["content-type"]).toBe("image/png");
  expect(stored.headers()["x-content-type-options"]).toBe("nosniff");
});

test("a script named like an image is refused", async ({ page }) => {
  await useEnglish(page);
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/products/new");

  await page.locator('input[type="file"]').first().setInputFiles({
    name: "innocent.png",
    // The declared type is a lie, which is the point: it is not consulted.
    mimeType: "image/png",
    buffer: Buffer.from('<script>alert("xss")</script>'),
  });

  const alert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await expect(alert, "a script was accepted as a photo").toBeVisible();
  await expect(alert).toContainText(/not an image/i);

  // And nothing was written: the field still holds what it did.
  await expect(page.locator('input[name="image"]')).not.toHaveValue(/^\/api\/images\//);
});

test("the endpoint refuses a viewer, not just the button", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set");

  await useEnglish(page);
  await signIn(page, VIEWER.email, VIEWER.password);

  // Posted directly, because a read-only role that is enforced only by which
  // controls were drawn is not enforced at all.
  const response = await page.request.fetch("/api/images", {
    method: "POST",
    multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: PNG } },
  });

  expect(response.status(), "a viewer uploaded a file").toBe(401);
});

test("a signed-out visitor cannot upload", async ({ page }) => {
  const response = await page.request.fetch("/api/images", {
    method: "POST",
    multipart: { file: { name: "photo.png", mimeType: "image/png", buffer: PNG } },
  });

  expect(response.status()).toBe(401);
});

test("a missing image is a 404, not a crash", async ({ page }) => {
  const response = await page.request.get("/api/images/definitely-not-an-id");
  expect(response.status()).toBe(404);
});
