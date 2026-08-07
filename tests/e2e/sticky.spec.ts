import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * Two things that look like the same bug and are not: something that should
 * scroll and does it twice, and something that should stay put and does not.
 *
 * Both are the kind of failure that reads as "the CSS is ignored" while every
 * property involved is set correctly — which is why they are pinned here
 * rather than trusted to a class name staying put.
 */

test.beforeEach(async ({ page }) => {
  await useEnglish(page);
  await page.setViewportSize({ width: 1280, height: 800 });
});

test("the filter rail is the only scroller in the sidebar", async ({ page }) => {
  await page.goto("/catalog");

  const scrollers = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (!aside) return null;

    return [...aside.querySelectorAll<HTMLElement>("*")]
      .filter((node) => {
        const style = getComputedStyle(node);
        return style.overflowY === "auto" || style.overflowY === "scroll";
      })
      .map((node) => String(node.className).slice(0, 50));
  });

  expect(scrollers, "no sidebar found").not.toBeNull();

  // Exactly one. A scrollbar inside a scrollbar sends the wheel to whichever
  // container the cursor happens to be over, and neither one tells you where
  // you are in the list.
  expect(scrollers, `nested scroll containers:\n${scrollers?.join("\n")}`).toHaveLength(1);
});

test("the product photo stays on screen while the details scroll", async ({ page }) => {
  await page.goto("/catalog");
  const href = await page.locator('a[href^="/product/"]').first().getAttribute("href");
  await page.goto(href!);

  const photo = page.locator(".aspect-square").first();
  await expect(photo).toBeVisible();

  const before = (await photo.boundingBox())!;

  await page.evaluate(() => window.scrollBy(0, 600));
  await expect.poll(async () => Math.round(window.scrollY ?? 0)).toBeGreaterThan(0);
  await page.waitForTimeout(300);

  const after = (await photo.boundingBox())!;

  // Sticky, so it should still be on screen after a 600px scroll rather than
  // having travelled the full distance with the page.
  expect(after.y, "the photo scrolled away with the page").toBeGreaterThan(before.y - 600);
  expect(after.y + after.height, "the photo left the viewport").toBeGreaterThan(0);
});

test("the photo is not stretched to the height of the details column", async ({ page }) => {
  // The root cause, asserted directly: a grid item defaults to
  // `align-self: stretch`, which leaves a sticky element no room to move. It
  // is a square by design, so its height should match its width.
  await page.goto("/catalog");
  const href = await page.locator('a[href^="/product/"]').first().getAttribute("href");
  await page.goto(href!);

  const box = (await page.locator(".aspect-square").first().boundingBox())!;
  expect(Math.abs(box.height - box.width), "the photo is not square, so it stretched")
    .toBeLessThan(4);
});
