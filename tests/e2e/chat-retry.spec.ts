import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * What the assistant does when the answer does not arrive.
 *
 * The failure is forced by intercepting the request rather than by provoking
 * the provider: the point is our handling of it, and a test that depended on a
 * model refusing would be measuring the wrong thing — and paying for it.
 *
 * The old message was "Couldn't get an answer. Please try again", and trying
 * again meant typing the question out a second time even though the transcript
 * was still on screen.
 */

const QUESTION = "Do you deliver to Batumi?";

test("a failed answer can be asked again without retyping it @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/");

  // Fail the first attempt, and only the first.
  let attempts = 0;
  await page.route("**/api/chat", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 500, body: "" });
      return;
    }
    // The second attempt is answered with a well-formed empty stream, so the
    // widget takes it as a reply rather than as another failure.
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
      body: `${JSON.stringify({ type: "text", value: "Yes, we do." })}\n`,
    });
  });

  await page.locator(".chat-launcher").click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();

  await panel.getByRole("textbox").fill(QUESTION);
  await panel.getByRole("textbox").press("Enter");

  const failure = panel.getByRole("alert");
  await expect(failure).toContainText(/couldn’t get an answer|couldn't get an answer/i);

  const again = failure.getByRole("button", { name: /ask again/i });
  await expect(again, "the failure offered no way to retry").toBeVisible();

  await again.click();

  // The question was sent a second time without the visitor retyping it, and
  // the transcript holds it once rather than twice.
  await expect.poll(() => attempts).toBe(2);
  await expect(panel.getByText(QUESTION)).toHaveCount(1);
  await expect(failure).toHaveCount(0);
});

test("a rate limit is not offered a retry @engine", async ({ page }) => {
  await useEnglish(page);
  await page.goto("/");

  // 429 is an answer, not an accident. Pressing "ask again" against it is a
  // button that is certain to fail, so it is not drawn.
  await page.route("**/api/chat", (route) => route.fulfill({ status: 429, body: "" }));

  await page.locator(".chat-launcher").click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("textbox").fill(QUESTION);
  await panel.getByRole("textbox").press("Enter");

  const failure = panel.getByRole("alert");
  await expect(failure).toBeVisible();
  await expect(failure.getByRole("button", { name: /ask again/i })).toHaveCount(0);
});
