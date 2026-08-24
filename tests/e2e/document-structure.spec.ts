import { expect, test } from "@playwright/test";

/**
 * How each page is built, as a screen reader reads it.
 *
 * Somebody using one navigates by heading and by landmark — jumping between
 * regions and skimming an outline — far more than by scrolling. That outline is
 * invisible to everyone else, so it rots without anybody noticing: a heading
 * picked for its size rather than its rank, a second `<nav>` with no name, a
 * link to the page you are already on that says nothing about it.
 *
 * None of this shows up in a screenshot, which is exactly why it is a test.
 */

const PAGES = [
  "/",
  "/catalog",
  "/product/ugreen-usb-c-hub-9in1",
  "/cart",
  "/login",
  "/register",
  "/track",
  "/about",
  "/faq",
  "/shipping",
  "/contact",
];

type Structure = {
  h1s: string[];
  skips: string[];
  landmarks: { main: number; banner: number; contentinfo: number };
  unnamedNavs: string[];
};

async function structureOf(page: import("@playwright/test").Page, path: string): Promise<Structure> {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");

  return page.evaluate(() => {
    const visible = (el: Element) => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      // `sr-only` text is *meant* to be in the outline, so size alone does not
      // disqualify an element — only being genuinely removed does.
      return true;
    };

    const headings = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")].filter(visible);

    const h1s = headings
      .filter((h) => h.tagName === "H1")
      .map((h) => (h.textContent ?? "").trim().slice(0, 40));

    // A level may repeat or step back any distance; it may only step *forward*
    // by one. h2 → h4 leaves a reader wondering what they missed.
    const skips: string[] = [];
    let previous = 0;
    for (const heading of headings) {
      const level = Number(heading.tagName[1]);
      if (previous && level > previous + 1) {
        skips.push(`h${previous} → h${level} at "${(heading.textContent ?? "").trim().slice(0, 30)}"`);
      }
      previous = level;
    }

    const count = (selector: string) => document.querySelectorAll(selector).length;

    /**
     * `<header>` is the page's banner only when nothing sections it.
     *
     * The element and the landmark are not the same thing: inside `article`,
     * `aside`, `main`, `nav` or `section` a `<header>` is the header *of that*
     * and carries no role at all. Counting elements was fine while only the
     * masthead had one — and then the shared page-title component started
     * putting a `<header>` inside `<main>` on every page, and the count
     * reported a second banner the site had not grown. Same rule for
     * `<footer>` and `contentinfo`.
     */
    const SECTIONED = "article, aside, main, nav, section";
    const landmarkCount = (selector: string) =>
      [...document.querySelectorAll(selector)].filter(
        (element) => !element.parentElement?.closest(SECTIONED),
      ).length;

    // Two navigations with no names are "navigation" and "navigation" in the
    // landmark list, which is no help at all.
    const navs = [...document.querySelectorAll("nav")].filter(visible);
    const unnamedNavs = navs
      .filter((nav) => {
        const label = nav.getAttribute("aria-label")?.trim();
        const by = nav.getAttribute("aria-labelledby");
        const referenced = by ? (document.getElementById(by)?.textContent ?? "").trim() : "";
        return !label && !referenced;
      })
      .map((nav) => `nav.${(nav.className || "").toString().slice(0, 40)}`);

    return {
      h1s,
      skips,
      landmarks: {
        main: count("main"),
        banner: landmarkCount("header"),
        contentinfo: landmarkCount("footer"),
      },
      unnamedNavs: navs.length > 1 ? unnamedNavs : [],
    };
  });
}

test("every page has exactly one first-level heading @engine", async ({ page }) => {
  test.slow();
  const wrong: string[] = [];

  for (const path of PAGES) {
    const { h1s } = await structureOf(page, path);
    if (h1s.length !== 1) wrong.push(`${path}: ${h1s.length} h1 — ${JSON.stringify(h1s)}`);
  }

  expect(wrong, "an h1 is the page's title to a screen reader; none and there is no title, two and there are two pages").toEqual([]);
});

test("no page skips a heading level @engine", async ({ page }) => {
  test.slow();
  const skipped: string[] = [];

  for (const path of PAGES) {
    const { skips } = await structureOf(page, path);
    for (const skip of skips) skipped.push(`${path}: ${skip}`);
  }

  expect(skipped, "a skipped level reads as a missing section").toEqual([]);
});

/**
 * The sign-in and sign-up pages carry one card and no site chrome, which is a
 * design decision rather than an oversight — so they are held to `<main>` and
 * not to a header and footer they deliberately do not have. Every page needs
 * somewhere to land; not every page needs a masthead.
 */
const CHROMELESS = ["/login", "/register"];

test("the landmarks are there, once each @engine", async ({ page }) => {
  test.slow();
  const wrong: string[] = [];

  for (const path of PAGES) {
    const { landmarks } = await structureOf(page, path);

    // Non-negotiable, everywhere.
    if (landmarks.main !== 1) wrong.push(`${path}: ${landmarks.main} <main>`);

    if (CHROMELESS.includes(path)) {
      // And they must not grow one by accident either — a header appearing
      // here would mean the auth layout had quietly been folded into the shop's.
      if (landmarks.banner !== 0) wrong.push(`${path}: has a <header> it should not`);
      continue;
    }

    if (landmarks.banner !== 1) wrong.push(`${path}: ${landmarks.banner} <header>`);
    if (landmarks.contentinfo !== 1) wrong.push(`${path}: ${landmarks.contentinfo} <footer>`);
  }

  expect(wrong, "landmarks are how a reader jumps around a page").toEqual([]);
});

test("every navigation says which navigation it is @engine", async ({ page }) => {
  test.slow();
  const unnamed: string[] = [];

  for (const path of PAGES) {
    const { unnamedNavs } = await structureOf(page, path);
    for (const nav of unnamedNavs) unnamed.push(`${path}: ${nav}`);
  }

  expect(unnamed, 'more than one navigation on a page, and at least one announces only as "navigation"').toEqual([]);
});

test("the current page is marked in the navigation @engine", async ({ page }) => {
  // Without `aria-current`, the link to the page you are already on is
  // indistinguishable from the ten around it — and it is the one piece of
  // orientation a reader cannot get any other way.
  for (const path of ["/catalog", "/about", "/contact"]) {
    await page.goto(path);

    const marked = await page.evaluate(
      (here) =>
        [...document.querySelectorAll(`a[href="${here}"]`)].some(
          (link) => link.getAttribute("aria-current") === "page",
        ),
      path,
    );

    expect(marked, `${path}: no link to the current page is marked with aria-current`).toBe(true);
  }
});
