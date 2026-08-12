import { expect, test } from "@playwright/test";

const PAGES = ["/", "/catalog", "/product/ugreen-usb-c-hub-9in1", "/cart", "/checkout", "/track", "/login", "/register", "/about", "/faq"];

/**
 * One test per width rather than one test for all of them.
 *
 * This was a single test doing 2 locales x 3 widths x 10 pages — sixty
 * navigations at roughly 0.7s each, which sat just under the 30s budget and
 * then went over it the first time a page gained a query. A timeout in a
 * layout test reads as a layout failure and is not one; splitting also names
 * the width in the failure, which is the first thing you want to know.
 */
for (const width of [320, 360, 390]) {
  test(`nothing spills out of its container at ${width}px @engine`, async ({ page }) => {
    // Twenty navigations — ten pages in two languages — and every one of them
    // queries a database ~150ms away. That fits the default budget on a good
    // run and sits close enough to it that a slow minute anywhere tips one of
    // these over, which is how this arrived as a failure that moved to a
    // different width each time. `slow` triples the allowance rather than
    // pretending the work is quicker than it is.
    test.slow();

    const findings: string[] = [];

    for (const locale of ["ka", "en"] as const) {
      await page.context().clearCookies();
      await page.context().addCookies([
        { name: "cm_locale", value: locale, url: "http://127.0.0.1:3100" },
      ]);

      await page.setViewportSize({ width, height: 800 });

      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("domcontentloaded");

        const bad = await page.evaluate(() => {
          const out: string[] = [];
          const seen = new Set<string>();

          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;

            const style = getComputedStyle(el);
            // Only *visible* overflow is a bug. Anything clipped or scrollable
            // is deliberate — a marquee track, a decorative blur, a rail. The
            // button bug this test exists for had `overflow: visible`, so it
            // is still caught.
            if (style.overflowX !== "visible") continue;

            // Content wider than the box — this catches buttons and any other
            // element with children, which an earlier version wrongly skipped.
            const spills = el.scrollWidth > el.clientWidth + 1;
            const clipped = style.webkitLineClamp !== "none" || style.textOverflow === "ellipsis";
            if (!spills || clipped) continue;

            const key = `${el.tagName}.${(el.className || "").toString().slice(0, 45)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(`${key} scrollW=${el.scrollWidth} clientW=${el.clientWidth}`);
          }
          return out;
        });

        for (const b of bad.slice(0, 3)) findings.push(`[${locale} ${width}] ${path}  ${b}`);
      }
    }

    // `.btn` used to set `white-space: nowrap` with a fixed height, so a long
    // Georgian label like "კალათაში დამატება" spilled straight out of the
    // button. This is the regression guard for that whole class of bug.
    expect(findings, `content spills out of its box:\n${findings.join("\n")}`).toEqual([]);
  });
}

/**
 * A phone turned sideways.
 *
 * Never checked before, and it is not the same question as a narrow width: the
 * viewport is *short*. What breaks in landscape is anything that assumed
 * vertical room — a sticky header eating a third of the screen, a drawer taller
 * than the viewport with its actions below the fold, a centred card that no
 * longer fits between the two.
 *
 * 667x375 is an iPhone SE on its side and the tightest case; 844x390 is a
 * current phone.
 */
for (const [width, height, name] of [
  [667, 375, "iPhone SE"],
  [844, 390, "a current phone"],
] as const) {
  test(`the storefront works on ${name} in landscape @engine`, async ({ page }) => {
    // Thirty-two navigations: the same ten pages, two languages, and both
    // orientations of the check. Same reasoning as the width sweep above.
    test.slow();

    await page.setViewportSize({ width, height });

    for (const locale of ["ka", "en"] as const) {
      await page.context().clearCookies();
      await page.context().addCookies([
        { name: "cm_locale", value: locale, url: "http://127.0.0.1:3100" },
      ]);

      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("domcontentloaded");

        const result = await page.evaluate(() => {
          const doc = document.documentElement;
          const header = document.querySelector("header");
          return {
            scrollsSideways: doc.scrollWidth > doc.clientWidth + 1,
            // A header is chrome. Past a third of a short viewport it stops
            // being chrome and starts being the page.
            headerShare: header ? header.getBoundingClientRect().height / window.innerHeight : 0,
          };
        });

        expect(result.scrollsSideways, `${path} scrolls sideways at ${width}x${height} in ${locale}`).toBe(
          false,
        );
        expect(
          result.headerShare,
          `${path}: the header takes ${Math.round(result.headerShare * 100)}% of a ${height}px viewport in ${locale}`,
        ).toBeLessThan(0.34);
      }
    }
  });
}

test("an open drawer keeps its actions on screen in landscape @engine", async ({ page }) => {
  // The case this exists for: a bottom sheet sized for a tall screen puts its
  // buttons below the fold when the phone is turned, and there is no way to
  // scroll to them because the page behind is locked.
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto("/catalog");

  await page.getByRole("button", { name: /filters|ფილტრები/i }).first().click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();

  // Wait for it to arrive, not merely to exist. The panel enters at
  // `translateY(100%)` and slides up, so measuring on `toBeVisible` catches it
  // mid-flight and reports a drawer hanging a screen's height below the fold —
  // which is what an earlier version of this test did, and it looked exactly
  // like the bug it was written to find.
  await expect
    .poll(
      async () => panel.evaluate((el) => Math.round(el.getBoundingClientRect().bottom)),
      { message: "the drawer never settled at the bottom of the screen" },
    )
    .toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));

  const fits = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), viewport: window.innerHeight };
  });

  expect(fits.top, "the drawer starts above the top of the screen").toBeGreaterThanOrEqual(0);
  expect(fits.bottom, "the drawer runs past the bottom of the screen").toBeLessThanOrEqual(
    fits.viewport + 1,
  );

  // And everything inside it is reachable, which for a panel taller than its
  // content means scrolling within the panel rather than the page.
  const reachable = await panel.evaluate((el) => {
    const scroller = [...el.querySelectorAll("*")].find((n) => n.scrollHeight > n.clientHeight + 1);
    return el.scrollHeight <= el.clientHeight + 1 || scroller !== undefined;
  });
  expect(reachable, "the drawer overflows with nothing able to scroll to the rest").toBe(true);
});
