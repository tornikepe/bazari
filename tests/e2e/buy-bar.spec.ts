import { expect, test, type Page } from "@playwright/test";

/**
 * The sticky buy bar.
 *
 * Driven here rather than in the dev browser pane because the bar is powered
 * by an IntersectionObserver, and an observer only fires in a page the browser
 * is actually rendering — a hidden pane delivers no callbacks at all, so the
 * bar looks broken when it is merely unobserved.
 */

const BASE = "http://127.0.0.1:3100";

async function openFirstProduct(page: Page) {
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "cm_locale", value: "en", url: BASE }]);

  await page.goto("/catalog");
  const first = page.locator('a[href^="/product/"]').first();
  await first.waitFor({ state: "attached" });
  const href = await first.getAttribute("href");
  await page.goto(href!);
}

const bar = (page: Page) => page.locator(".buy-bar");
const panel = (page: Page) => page.locator("#buy-panel");

test("stays hidden while the real purchase panel is on screen", async ({ page }) => {
  await openFirstProduct(page);

  await expect(panel(page)).toBeVisible();
  // Two add-to-cart buttons on screen at once is worse than none.
  await expect(bar(page)).toHaveAttribute("data-shown", "false");
});

test("appears once the panel has scrolled away, and goes again on the way back", async ({
  page,
}) => {
  await openFirstProduct(page);

  await panel(page).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 1200);
  await expect(bar(page)).toHaveAttribute("data-shown", "true");

  // The price and a working button, not just a strip of colour.
  await expect(bar(page).getByRole("button", { name: /add to cart/i })).toBeEnabled();
  await expect(bar(page)).toContainText("₾");

  await page.mouse.wheel(0, -2000);
  await expect(bar(page)).toHaveAttribute("data-shown", "false");
});

test("is not a tab stop while it is hidden", async ({ page }) => {
  await openFirstProduct(page);

  // A keyboard user must not land on a button they cannot see. The bar is
  // translated off screen rather than unmounted, so this needs saying — and
  // it is covered twice over.
  //
  // `visibility: hidden` takes the whole subtree out of the accessibility
  // tree, so a role query finds nothing at all:
  await expect(bar(page).getByRole("button", { name: /add to cart/i })).toHaveCount(0);

  // …and the button is disabled regardless, so it stays out of the tab order
  // even during the transition, when visibility is briefly still resolving.
  const button = bar(page).locator("button").first();
  await expect(button).toBeDisabled();
});

test("lifts the chat launcher instead of covering it", async ({ page }) => {
  await openFirstProduct(page);

  const launcher = page.locator(".chat-launcher");
  test.skip((await launcher.count()) === 0, "no chat provider configured");

  const resting = (await launcher.boundingBox())!;

  await panel(page).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 1200);
  await expect(bar(page)).toHaveAttribute("data-shown", "true");

  const raised = (await launcher.boundingBox())!;
  const barBox = (await bar(page).boundingBox())!;

  // Both are fixed to the bottom-right. Without the --buy-bar-h handshake the
  // one that wins is whichever came later in the stylesheet.
  expect(raised.y).toBeLessThan(resting.y);
  expect(raised.y + raised.height).toBeLessThanOrEqual(barBox.y + 1);
});

test("adds to the cart from the bar itself", async ({ page }) => {
  await openFirstProduct(page);

  await panel(page).scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 1200);
  await expect(bar(page)).toHaveAttribute("data-shown", "true");

  await bar(page).getByRole("button", { name: /add to cart/i }).click();

  await page.goto("/cart");
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible();
});

test("fits a phone without pushing the page sideways", async ({ page }) => {
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 780 });
    await openFirstProduct(page);

    await panel(page).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 1200);
    await expect(bar(page)).toHaveAttribute("data-shown", "true");

    const box = (await bar(page).boundingBox())!;
    expect(box.x, `bar starts off screen at ${width}px`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `bar overflows at ${width}px`).toBeLessThanOrEqual(width);

    const scrolls = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(scrolls, `the page scrolls sideways at ${width}px`).toBe(false);
  }
});
