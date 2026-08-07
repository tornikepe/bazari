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
  test(`nothing spills out of its container at ${width}px`, async ({ page }) => {
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
