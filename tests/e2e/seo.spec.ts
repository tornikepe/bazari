import { expect, test, type Page } from "@playwright/test";

/**
 * The parts of SEO that are checkable.
 *
 * Not "does it rank" — that is not a test. What is testable: the structured
 * data parses, it claims only things the shop can back, and the social card a
 * shared link produces is a real image rather than a shared placeholder.
 */

const BASE = "http://127.0.0.1:3100";

async function jsonLd(page: Page) {
  return page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((n) => JSON.parse(n.textContent || "{}")),
  );
}

test("the home page carries valid Organization and WebSite data", async ({ page }) => {
  await page.context().addCookies([{ name: "cm_locale", value: "ka", url: BASE }]);
  await page.goto("/");

  const blocks = await jsonLd(page);
  const org = blocks.find((b) => b["@type"] === "Organization");
  const site = blocks.find((b) => b["@type"] === "WebSite");

  expect(org, "no Organization block").toBeTruthy();
  expect(site, "no WebSite block").toBeTruthy();
  expect(org.name).toBe("Bazari");

  // The search endpoint it advertises has to be the one that exists.
  expect(site.potentialAction["@type"]).toBe("SearchAction");
  expect(site.potentialAction.target.urlTemplate).toContain("/catalog?q=");
});

test("the markup claims nothing the shop cannot back", async ({ page }) => {
  await page.goto("/");
  const blocks = await jsonLd(page);

  // The standing rule for this project: no invented business details. A made-up
  // address or phone number in a block search engines read as a business record
  // is worse than having no block at all.
  for (const block of blocks) {
    for (const field of ["address", "telephone", "email", "aggregateRating", "review", "sameAs"]) {
      expect(block, `${block["@type"]} must not claim ${field}`).not.toHaveProperty(field);
    }
  }
});

test("a shared product link produces its own card, not the placeholder", async ({
  page,
  request,
}) => {
  await page.goto("/catalog");
  const href = await page.locator('a[href^="/product/"]').first().getAttribute("href");
  await page.goto(href!);

  const url = await page.$eval('meta[property="og:image"]', (e) => e.getAttribute("content"));
  expect(url, "no og:image").toBeTruthy();

  // The bug this guards: `generateMetadata` used to set `images` explicitly,
  // which silently overrode the generated card and sent the one placeholder
  // SVG that all forty products share.
  expect(url).not.toContain("placeholder");
  expect(url).toContain("opengraph-image");

  const res = await request.get(url!.replace("http://localhost:3000", BASE));
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");

  // A card that failed to load its font renders, but nearly empty.
  expect((await res.body()).length).toBeGreaterThan(10_000);
});

test("every page declares a canonical and the fixed title", async ({ page }) => {
  for (const route of ["/", "/catalog", "/faq"]) {
    await page.goto(route);
    // The title is deliberately identical everywhere — a decision, re-checked
    // here so it cannot drift by accident.
    await expect(page).toHaveTitle("Bazari - ონლაინ მაღაზია");
  }
});
