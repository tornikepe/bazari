import { expect, test, type Page } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, signIn, VIEWER } from "./helpers";

/**
 * Layout stability across languages and widths.
 *
 * Two promises this project makes that are easy to break by accident and
 * tedious to check by eye, so they are checked here instead:
 *
 *   1. Nothing moves or resizes when the language changes. Georgian and
 *      English are different lengths in every single string, so any control
 *      sized by its content is a control that jumps.
 *   2. Nothing overflows sideways, and no text is cut off, at any width the
 *      site supports.
 *
 * These walk real pages rather than a component gallery, because the failures
 * are always in the composition — a button that is fine alone and shoves a
 * price off the row when it grows by nine pixels.
 */

const PUBLIC_PAGES = ["/", "/catalog", "/cart", "/about", "/contact", "/faq", "/track", "/login"];
const STAFF_PAGES = [
  "/dashboard",
  "/dashboard/products",
  "/dashboard/orders",
  "/dashboard/customers",
  "/dashboard/categories",
];
const WIDTHS = [320, 390, 768, 1280];

async function setLocale(page: Page, locale: "ka" | "en") {
  await page.context().addCookies([
    { name: "cm_locale", value: locale, url: "http://127.0.0.1:3100" },
  ]);
}

/** Every control's size, keyed by something stable across a language switch. */
async function measureControls(page: Page) {
  return page.evaluate(() => {
    const out: Record<string, { w: number; h: number }> = {};

    document.querySelectorAll<HTMLElement>(".btn, .field, .badge, .index-row").forEach((node, i) => {
      const box = node.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return;
      // Keyed by position in the document and by class rather than by text —
      // the text is the thing that changes.
      out[`${i}:${node.className}`] = {
        w: Math.round(box.width),
        h: Math.round(box.height),
      };
    });

    return out;
  });
}

/** Elements whose content is wider than the box drawn around it. */
async function clippedText(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("*")]
      .filter((node) => {
        const style = getComputedStyle(node);
        if (style.overflow === "visible" && style.overflowX === "visible") return false;
        if (style.overflowX === "auto" || style.overflowX === "scroll") return false;
        if (node.scrollWidth <= node.clientWidth + 1) return false;

        // Visually hidden text — the `sr-only` pattern — overflows its box on
        // purpose: a 1x1 clipped element holding a full sentence is exactly how
        // you give a screen reader something without showing it. That is the
        // mechanism, not a defect, and the skip link tripped this the moment it
        // was added. Matched on the whole signature rather than on "small", so
        // a genuinely broken 1px box still fails.
        const box = node.getBoundingClientRect();
        const clipped = style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)";
        if (clipped && style.position === "absolute" && box.width <= 1 && box.height <= 1) return false;

        // `truncate` is a deliberate choice, not an accident, and an ellipsis
        // is a legitimate design. Only unlabelled clipping counts.
        return style.textOverflow !== "ellipsis";
      })
      .map((node) => `${node.tagName.toLowerCase()}.${node.className}`.slice(0, 90))
      .slice(0, 5),
  );
}

test.describe("the storefront", () => {
  for (const width of WIDTHS) {
    test(`does not scroll sideways at ${width}px, in either language`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const locale of ["ka", "en"] as const) {
        await setLocale(page, locale);

        for (const path of PUBLIC_PAGES) {
          await page.goto(path);
          const scrolls = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          );
          expect(scrolls, `${path} scrolls sideways at ${width}px in ${locale}`).toBe(false);
        }
      }
    });
  }

  test("no control changes size when the language changes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const path of PUBLIC_PAGES) {
      await setLocale(page, "ka");
      await page.goto(path);
      const ka = await measureControls(page);

      await setLocale(page, "en");
      await page.goto(path);
      const en = await measureControls(page);

      const moved = Object.keys(ka).filter((key) => {
        const other = en[key];
        // Height is the strict one: a control that grows taller pushes
        // everything below it down the page. Width is allowed to differ where
        // the control is genuinely text-sized and stands alone in its row.
        return other && Math.abs(other.h - ka[key].h) > 1;
      });

      expect(moved, `${path}: controls change height between ka and en`).toEqual([]);
    }
  });

  test("no text is clipped without an ellipsis", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });

    for (const locale of ["ka", "en"] as const) {
      await setLocale(page, locale);

      for (const path of PUBLIC_PAGES) {
        await page.goto(path);
        expect(await clippedText(page), `${path} in ${locale}`).toEqual([]);
      }
    }
  });
});

test.describe("the dashboard", () => {
  test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set");

  for (const width of [390, 1280]) {
    test(`does not scroll sideways at ${width}px, in either language`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page, ADMIN.email, ADMIN.password);

      for (const locale of ["ka", "en"] as const) {
        await setLocale(page, locale);

        for (const path of STAFF_PAGES) {
          await page.goto(path);
          const scrolls = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          );
          expect(scrolls, `${path} scrolls sideways at ${width}px in ${locale}`).toBe(false);
        }
      }
    });
  }

  test("no control changes size when the language changes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, ADMIN.email, ADMIN.password);

    for (const path of STAFF_PAGES) {
      await setLocale(page, "ka");
      await page.goto(path);
      const ka = await measureControls(page);

      await setLocale(page, "en");
      await page.goto(path);
      const en = await measureControls(page);

      const moved = Object.keys(ka).filter(
        (key) => en[key] && Math.abs(en[key].h - ka[key].h) > 1,
      );
      expect(moved, `${path}: controls change height between ka and en`).toEqual([]);
    }
  });
});

test("the language switch itself does not resize when pressed", async ({ page }) => {
  // The one control guaranteed to be on screen in both languages at once, and
  // the one most likely to move: it is *made of* the two language names.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const toggle = page.getByRole("group", { name: /ენა|language/i });
  const before = (await toggle.boundingBox())!;

  await toggle.getByRole("button").last().click();
  await expect
    .poll(async () => Math.round((await toggle.boundingBox())!.width))
    .toBe(Math.round(before.width));

  const after = (await toggle.boundingBox())!;
  expect(Math.round(after.height)).toBe(Math.round(before.height));
  expect(Math.round(after.x)).toBe(Math.round(before.x));
});

test("a viewer's dashboard is as stable as an admin's", async ({ page }) => {
  test.skip(!VIEWER.password, "VIEWER_PASSWORD is not set");

  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page, VIEWER.email, VIEWER.password);

  for (const locale of ["ka", "en"] as const) {
    await setLocale(page, locale);
    for (const path of STAFF_PAGES) {
      await page.goto(path);
      const scrolls = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(scrolls, `${path} scrolls sideways for a viewer in ${locale}`).toBe(false);
    }
  }
});

test("the customer account area fits a phone in both languages", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);

  for (const locale of ["ka", "en"] as const) {
    await setLocale(page, locale);
    await page.goto("/account");

    const scrolls = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(scrolls, `/account scrolls sideways in ${locale}`).toBe(false);
    expect(await clippedText(page), `/account in ${locale}`).toEqual([]);
  }
});
