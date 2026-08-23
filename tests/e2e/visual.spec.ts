import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * What the site looks like.
 *
 * Every other test in this suite asks whether something *works*. None of them
 * would notice a heading losing its weight, a card losing its border, or dark
 * mode turning a price the same colour as its background — and those are the
 * faults a redesign introduces by accident. This is the only check that would.
 *
 * Three axes, not four, and the omission is deliberate:
 *
 *   - **width and language together**, in the light theme, because that is the
 *     pair that breaks layout: Georgian is the longer language and 390px is
 *     the tighter screen, and every layout fault this project has found
 *     appeared where the two met;
 *   - **theme alone**, at desktop width in English, because a theme fault is a
 *     colour fault and shows at any size.
 *
 * The full product — two widths × two languages × two themes on every page —
 * is eight images a page for a class of bug that six already catch, and the
 * repository carries every one of them for ever.
 */

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

/**
 * Regions painted over before the comparison.
 *
 * Not decoration: this suite shares a database with tests that place orders,
 * sell stock down and edit products. A price or a stock badge that moved
 * because the checkout suite bought something is a diff about nothing, and a
 * screenshot test that cries wolf is one that gets ignored and then deleted.
 *
 * What is masked is the *content* of those elements. Their boxes still take up
 * space, so a card that changes shape still fails.
 */
function volatileParts(page: Page): Locator[] {
  return [
    // Prices, stock counts and delivery estimates all move with the data.
    page.locator(".tabular-nums"),
    page.locator(".badge"),
    // The assistant floats over everything and animates on a timer of its own.
    page.locator(".chat-launcher"),
  ];
}

async function shoot(page: Page, name: string, extra: Locator[] = []) {
  // `networkidle` rather than `load`: fonts and the product images decide the
  // layout, and a screenshot taken before they land is a picture of a page
  // that never existed.
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveScreenshot(name, {
    fullPage: true,
    // Nothing may be mid-flight. Transitions are the single largest source of
    // one-pixel differences between two runs of the same code.
    animations: "disabled",
    caret: "hide",
    mask: [...volatileParts(page), ...extra],
    /* One pixel in a thousand.
     *
     * Text rendering is not bit-identical between two runs even on one
     * machine, so the allowance cannot be zero. It cannot be generous either:
     * the primary button repainted a different colour is 2% of a full-page
     * screenshot, so a 1% tolerance would have let half a redesign through.
     * Measured rather than guessed — two consecutive runs of this suite
     * against unchanged code differ by nothing at all. */
    maxDiffPixelRatio: 0.001,
  });
}

/** The pages worth watching, and anything on them that moves by itself. */
const PAGES: { name: string; path: string; masks?: (page: Page) => Locator[] }[] = [
  { name: "home", path: "/" },
  { name: "catalog", path: "/catalog" },
  { name: "cart-empty", path: "/cart" },
  { name: "track", path: "/track" },
  { name: "login", path: "/login" },
  { name: "not-found", path: "/no-such-page" },
];

for (const { name, path, masks } of PAGES) {
  test.describe(name, () => {
    for (const locale of ["ka", "en"] as const) {
      for (const [size, viewport] of [
        ["wide", WIDE],
        ["phone", PHONE],
      ] as const) {
        test(`${name} · ${locale} · ${size} @visual`, async ({ page }) => {
          await page.context().addCookies([
            { name: "cm_locale", value: locale, url: "http://127.0.0.1:3100" },
          ]);
          await page.setViewportSize(viewport);
          await page.goto(path);
          await shoot(page, `${name}-${locale}-${size}.png`, masks?.(page));
        });
      }
    }

    test(`${name} · dark @visual`, async ({ page }) => {
      await page.context().addCookies([
        { name: "cm_locale", value: "en", url: "http://127.0.0.1:3100" },
      ]);
      await page.setViewportSize(WIDE);
      await page.goto(path);

      /* Set on the element rather than through `emulateMedia`, because that is
         how a reader chooses it here: the toggle writes `data-theme`, and the
         system preference is only the default. Testing the media query would
         test a path the toggle does not take. */
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));

      await shoot(page, `${name}-dark.png`, masks?.(page));
    });
  });
}
