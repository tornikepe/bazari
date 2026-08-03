import { expect, test, type Page } from "@playwright/test";

/**
 * The contact assistant's shell.
 *
 * Deliberately never sends a message: the answer would come from a metered API
 * and the assertion would be about what a model chose to say, which is not a
 * test — it's a coin toss with a bill attached. What is tested here is
 * everything the widget owes the visitor regardless of the reply: that it
 * opens, closes, keeps the keyboard usable, and fits on a 320px screen in both
 * languages.
 *
 * The suite runs with a placeholder `ANTHROPIC_API_KEY` (see
 * `playwright.config.ts`) purely so the launcher is rendered at all.
 */

const BASE = "http://127.0.0.1:3100";

async function applyLocale(page: Page, locale: "ka" | "en") {
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "cm_locale", value: locale, url: BASE }]);
}

function launcher(page: Page) {
  return page.locator(".chat-launcher");
}

function panel(page: Page) {
  return page.getByRole("dialog");
}

test("opens, answers nothing yet, and closes again", async ({ page }) => {
  await applyLocale(page, "en");
  await page.goto("/");

  await expect(launcher(page)).toBeVisible();
  await expect(panel(page)).toBeHidden();

  await launcher(page).click();
  await expect(panel(page)).toBeVisible();

  // The greeting is markup, not a model turn — it must be on screen before any
  // request is made, or an unconfigured deployment shows an empty box.
  await expect(panel(page)).toContainText(/find products/i);
  await expect(page.locator(".chat-suggestion")).toHaveCount(3);

  // Says out loud what it cannot do, so nobody types "cancel my order" and
  // waits for a human to read it.
  await expect(panel(page)).toContainText(/can't change or cancel an order/i);

  await page.getByRole("button", { name: /^close$/i }).first().click();
  await expect(panel(page)).toBeHidden();
});

test("escape closes it and focus goes back to the launcher", async ({ page }) => {
  await applyLocale(page, "en");
  await page.goto("/");

  await launcher(page).click();
  await expect(panel(page)).toBeVisible();
  // Opening focuses the composer, so a visitor can type immediately.
  await expect(page.locator(".chat-input")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(launcher(page)).toBeFocused();
});

test("the send button stays disabled until something is typed", async ({ page }) => {
  await applyLocale(page, "en");
  await page.goto("/");
  await launcher(page).click();

  const send = page.getByRole("button", { name: /^send$/i });
  await expect(send).toBeDisabled();

  await page.locator(".chat-input").fill("   ");
  await expect(send).toBeDisabled();

  await page.locator(".chat-input").fill("Do you sell headphones?");
  await expect(send).toBeEnabled();
});

test("the open panel fits a phone in both languages", async ({ page }) => {
  const findings: string[] = [];

  for (const locale of ["ka", "en"] as const) {
    await applyLocale(page, locale);

    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/");
      await launcher(page).click();
      await expect(panel(page)).toBeVisible();

      // The panel is fixed, so a document-level overflow check would miss it
      // entirely — measure the element itself against the viewport.
      const box = (await panel(page).boundingBox())!;
      if (box.x < 0 || box.x + box.width > width) {
        findings.push(`[${locale} ${width}] panel spans ${box.x}…${box.x + box.width}`);
      }

      const spills = await page.evaluate(() => {
        const out: string[] = [];
        const root = document.querySelector('[role="dialog"]');
        if (!root) return ["no panel"];

        for (const el of [root, ...root.querySelectorAll("*")]) {
          const style = getComputedStyle(el);
          // Same rule as the site-wide responsive test: only *visible*
          // overflow is a bug — the message list is meant to scroll.
          if (style.overflowX !== "visible") continue;
          if (style.textOverflow === "ellipsis") continue;
          if (el.scrollWidth > el.clientWidth + 1) {
            out.push(`${el.tagName}.${(el.className || "").toString().slice(0, 40)}`);
          }
        }
        return out;
      });

      for (const spill of spills) findings.push(`[${locale} ${width}] ${spill}`);
    }
  }

  expect(findings, `the chat panel spills out:\n${findings.join("\n")}`).toEqual([]);
});

test("the launcher does not cover the footer links it sits over", async ({ page }) => {
  await applyLocale(page, "en");
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/");

  // The widget's container spans the viewport so the panel can be positioned
  // against it. If that container swallowed clicks, every link on the page
  // would silently stop working — this is the guard for that.
  await page.getByRole("link", { name: /catalog/i }).first().click();
  await expect(page).toHaveURL(/\/catalog/);
});
