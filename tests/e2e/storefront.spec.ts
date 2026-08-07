import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

test.beforeEach(async ({ page }) => useEnglish(page));

/** `count()` does not auto-wait, and the grid is streamed. */
/**
 * How many products are on the page.
 *
 * Counts cards, not `/product/` links: each card holds two links to the same
 * product — the image and the title — so counting links double-counted every
 * result and made the numbers hard to reason about.
 *
 * It also waits for the count to settle rather than reading it the moment the
 * first card attaches. The page streams, so an immediate read catches a
 * partial render: this test once reported 4 for one spelling and 2 for the
 * other with identical pages behind them, and read as a case-sensitivity bug
 * in Postgres.
 */
async function countProducts(page: import("@playwright/test").Page) {
  const cards = page.locator("article");
  await cards.first().waitFor({ state: "attached" });

  let previous = -1;
  for (let i = 0; i < 20; i++) {
    const current = await cards.count();
    if (current === previous) return current;
    previous = current;
    await page.waitForTimeout(100);
  }
  return previous;
}

test("the catalogue lists products and filters by category", async ({ page }) => {
  await page.goto("/catalog");
  const all = await countProducts(page);
  expect(all).toBeGreaterThan(0);

  await page.goto("/catalog?category=audio");
  const filtered = await countProducts(page);
  expect(filtered).toBeGreaterThan(0);
  expect(filtered).toBeLessThanOrEqual(all);
});

test("search is case-insensitive", async ({ page }) => {
  // Postgres LIKE is case-sensitive where SQLite was not, and this broke
  // silently after the migration.
  await page.goto("/catalog?q=anker");
  const lower = await countProducts(page);

  await page.goto("/catalog?q=ANKER");
  const upper = await countProducts(page);

  expect(lower).toBeGreaterThan(0);
  expect(upper).toBe(lower);
});

test("the title is identical on every page", async ({ page }) => {
  const titles: string[] = [];
  for (const path of ["/", "/catalog", "/cart", "/login"]) {
    await page.goto(path);
    titles.push(await page.title());
  }
  expect(new Set(titles).size).toBe(1);
});

test("the two locales lay out identically", async ({ page, context }) => {
  // Loads each locale fresh rather than clicking the switch: `router.refresh()`
  // makes the timing flaky, and comparing two clean renders tests the property
  // that actually matters — the same page in either language occupies the same
  // space. Positions are document-relative, since a rect is viewport-relative
  // and would turn a scroll difference into a phantom shift.
  const landmarks = ["header", "aside", "h1", "article.card"];

  const geometry = () =>
    page.evaluate(
      (selectors) =>
        selectors.flatMap((selector) =>
          [...document.querySelectorAll(selector)].slice(0, 6).map((el, i) => {
            const r = el.getBoundingClientRect();
            return `${selector}#${i} h=${Math.round(r.height)} y=${Math.round(r.y + window.scrollY)}`;
          }),
        ),
      landmarks,
    );

  const forLocale = async (locale: "en" | "ka") => {
    await context.clearCookies();
    await context.addCookies([
      { name: "cm_locale", value: locale, url: "http://127.0.0.1:3100" },
    ]);
    await page.goto("/catalog");
    await page.locator('a[href^="/product/"]').first().waitFor({ state: "attached" });

    // Cards animate in with a transform, so a rect measured mid-flight is the
    // animation's position, not the layout's. Freeze them first.
    await page.addStyleTag({
      content: "*,*::before,*::after{animation:none!important;transition:none!important}",
    });
    await page.waitForTimeout(200);

    return geometry();
  };

  const english = await forLocale("en");
  expect(english.length).toBeGreaterThan(0);

  expect(await forLocale("ka")).toEqual(english);
});

test("nothing overflows horizontally on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });

  for (const path of ["/", "/catalog", "/cart", "/checkout"]) {
    await page.goto(path);
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflows, `${path} scrolls sideways at 320px`).toBe(false);
  }
});

/**
 * A withdrawn product must answer 404, not 200.
 *
 * This is also the guard on a mistake that is easy to make twice: adding a
 * `loading.tsx` to `product/[slug]` starts the response streaming, and once
 * headers are sent the status can no longer change — so `notFound()` renders
 * the 404 page under a 200. Next marks it `noindex` so it isn't indexed, but
 * it still reads as a soft 404 to analytics and to anything checking status.
 * The skeleton is not worth that; the route stays unstreamed.
 */
test("any unknown path renders the 404 page, not a crash", async ({ page }) => {
  for (const path of ["/nope", "/catalog/nope", "/product/does-not-exist", "/a/b/c"]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should 404`).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
  }
});

test("the 404 page offers a way onwards", async ({ page }) => {
  await page.goto("/nope");
  // The header has a search box too; this one is inside the page body.
  const form = page.locator('main form[action="/catalog"]');
  await form.getByRole("searchbox").fill("anker");
  await form.getByRole("button", { name: /search|ძებნა/i }).click();

  await expect(page).toHaveURL(/\/catalog\?q=anker/);
});

test("the product page carries valid structured data", async ({ page }) => {
  await page.goto("/product/ugreen-usb-c-hub-9in1");

  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(blocks.length).toBeGreaterThanOrEqual(2);

  const parsed = blocks.map((b) => JSON.parse(b));
  const product = parsed.find((p) => p["@type"] === "Product");
  const crumbs = parsed.find((p) => p["@type"] === "BreadcrumbList");

  expect(product).toBeTruthy();
  expect(product.offers.priceCurrency).toBe("GEL");
  expect(product.offers.price).toMatch(/^\d+\.\d{2}$/);
  expect(product.sku).toBeTruthy();

  // The shop has no ratings or reviews, so the markup must not claim any.
  expect(product.aggregateRating).toBeUndefined();
  expect(product.review).toBeUndefined();

  expect(crumbs.itemListElement).toHaveLength(4);
});
