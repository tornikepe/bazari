import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

test.beforeEach(async ({ page }) => useEnglish(page));

/** `count()` does not auto-wait, and the grid is streamed. */
async function countProducts(page: import("@playwright/test").Page) {
  const links = page.locator('a[href^="/product/"]');
  await links.first().waitFor({ state: "attached" });
  return links.count();
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
