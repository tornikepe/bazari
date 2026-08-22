import { expect, test } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * The two controls above the results, on a phone.
 *
 * They used to take a line each, and the reason was not taste: sorting was a
 * `<select>`, and a `<select>` cannot be laid out narrower than its longest
 * option. In Georgian that option is "ფასი: დაბლიდან მაღლა", which is wider
 * than the space beside the filter button on every phone made — and on an
 * iPhone SE the row overflowed by 15px in WebKit while Chromium measured it as
 * fine. Sorting is a button and a sheet on phones now, so both fit.
 */

test.describe.configure({ mode: "parallel" });

for (const width of [320, 360, 390]) {
  test(`the filter and sort controls share one row at ${width}px @engine`, async ({ page }) => {
    // Georgian on purpose: it is the longer language, and the fault this
    // guards only ever appeared there.
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/catalog?category=electronics");

    const filters = page.getByRole("button", { name: /ფილტრები/ });
    const sort = page.getByRole("button", { name: /დალაგება/ });

    const [a, b] = [await filters.boundingBox(), await sort.boundingBox()];
    expect(a, "the filter button is not on the page").not.toBeNull();
    expect(b, "the sort button is not on the page").not.toBeNull();

    // Same row, and the row is not wider than the phone.
    expect(Math.abs(a!.y - b!.y), "the two controls are on different rows").toBeLessThan(4);
    expect(b!.x + b!.width, "the row runs off the screen").toBeLessThanOrEqual(width);

    // And both are comfortable to hit — the select they replaced was 36px.
    for (const box of [a!, b!]) expect(box.height).toBeGreaterThanOrEqual(44);
  });
}

test("sorting from the sheet actually sorts @engine", async ({ page }) => {
  await useEnglish(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/catalog");

  await page.getByRole("button", { name: /^sort$/i }).click();

  const sheet = page.getByRole("radiogroup", { name: /sort/i });
  await expect(sheet).toBeVisible();

  // The one in force says so, which is the only thing that tells a screen
  // reader what the catalogue is currently ordered by.
  await expect(sheet.getByRole("radio", { name: /newest/i })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  await sheet.getByRole("radio", { name: /price: low/i }).click();

  await expect(page).toHaveURL(/sort=price-asc/);
  await expect(sheet, "the sheet stayed open after a choice was made").toBeHidden();

  // Reopened, it reflects the choice rather than the default.
  await page.getByRole("button", { name: /^sort$/i }).click();
  await expect(
    page.getByRole("radiogroup", { name: /sort/i }).getByRole("radio", { name: /price: low/i }),
  ).toHaveAttribute("aria-checked", "true");
});
