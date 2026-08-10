import { expect, test } from "@playwright/test";

/**
 * Tap targets and accessible names, across every public page.
 *
 * This replaces a script that was run by hand once and quoted in the roadmap
 * for three days afterwards. Two things came out of turning it into a test:
 *
 * **The headline number was wrong.** It reported "400 controls under 24×24 —
 * real" and treated that as a WCAG failure. It is not one. SC 2.5.8 has a
 * spacing exception: an undersized target passes if a 24px circle on its centre
 * touches no other target's circle. The footer links it was mostly counting sat
 * 34px apart and cleared that comfortably. Measured properly, the site had
 * **zero** target-size failures — and the work that followed was an ergonomic
 * improvement, not a conformance fix. An audit that cannot tell those apart
 * sends you to redesign things the standard never objected to.
 *
 * **The name check was broken.** It read `aria-label`, then text, then `alt` —
 * and never looked up `label[for]`, which is how nearly every input on a form
 * gets its name. It reported ten correctly-labelled fields as unnamed. A
 * finding that is wrong costs more than a finding that is missing, because
 * somebody acts on it.
 *
 * So this asserts the two things that are genuinely required, and prints the
 * ergonomic number without failing on it.
 */

const PAGES = [
  "/",
  "/catalog",
  "/product/ugreen-usb-c-hub-9in1",
  "/cart",
  "/checkout",
  "/track",
  "/login",
  "/register",
  "/about",
  "/faq",
  "/shipping",
  "/returns",
  "/warranty",
  "/terms",
  "/privacy",
  "/contact",
];

/** WCAG 2.2 SC 2.5.8 minimum, and the diameter of the spacing circle. */
const MINIMUM = 24;
/** What Apple and Google ask for. Reported, not enforced. */
const COMFORTABLE = 44;

type Finding = { page: string; key: string; detail: string };

async function sweep(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");

  return page.evaluate(
    ({ minimum, comfortable }) => {
      const SELECTOR =
        'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';

      const visible: { el: Element; r: DOMRect }[] = [];
      for (const el of document.querySelectorAll(SELECTOR)) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        visible.push({ el, r });
      }

      const describe = (el: Element) =>
        `${el.tagName.toLowerCase()}.${(el.className || "").toString().replace(/\s+/g, ".").slice(0, 50)}`;

      /** The parts of accname that apply to the controls this site renders. */
      const nameOf = (el: Element): string => {
        const aria = el.getAttribute("aria-label")?.trim();
        if (aria) return aria;

        const labelledBy = el.getAttribute("aria-labelledby");
        if (labelledBy) {
          const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ")
            .trim();
          if (text) return text;
        }

        // The one a first version missed, and the one most inputs rely on.
        if (el.id) {
          const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (label?.textContent?.trim()) return label.textContent.trim();
        }
        const wrapping = el.closest("label");
        if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();

        const text = (el.textContent ?? "").trim();
        if (text) return text;

        const alt = el.querySelector("img")?.getAttribute("alt")?.trim();
        if (alt) return alt;

        const title = el.getAttribute("title")?.trim();
        if (title) return title;

        return (el.getAttribute("placeholder") ?? "").trim();
      };

      const tooClose = (r: DOMRect, index: number) => {
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        return visible.some((other, i) => {
          if (i === index) return false;
          const ox = other.r.x + other.r.width / 2;
          const oy = other.r.y + other.r.height / 2;
          return Math.hypot(cx - ox, cy - oy) < minimum;
        });
      };

      const failures: { key: string; detail: string }[] = [];
      const unnamed: { key: string; detail: string }[] = [];
      let belowComfortable = 0;

      visible.forEach(({ el, r }, index) => {
        const w = Math.round(r.width);
        const h = Math.round(r.height);

        if (w < comfortable || h < comfortable) belowComfortable += 1;

        if ((w < minimum || h < minimum) && tooClose(r, index)) {
          failures.push({ key: describe(el), detail: `${w}x${h}, and within ${minimum}px of another target` });
        }

        if (!nameOf(el)) {
          unnamed.push({ key: describe(el), detail: "no accessible name — announced only as its role" });
        }
      });

      return { failures, unnamed, belowComfortable, total: visible.length };
    },
    { minimum: MINIMUM, comfortable: COMFORTABLE },
  );
}

for (const locale of ["ka", "en"] as const) {
  test(`every control is reachable and named — ${locale}`, async ({ page }) => {
    // A thumb, not a mouse: the width where target size is decided.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.context().addCookies([
      { name: "cm_locale", value: locale, url: "http://127.0.0.1:3100" },
    ]);

    const failures: Finding[] = [];
    const unnamed: Finding[] = [];
    let belowComfortable = 0;
    let total = 0;

    for (const path of PAGES) {
      const result = await sweep(page, path);
      for (const f of result.failures) failures.push({ page: path, ...f });
      for (const u of result.unnamed) unnamed.push({ page: path, ...u });
      belowComfortable += result.belowComfortable;
      total += result.total;
    }

    // Not an assertion: 44px is a recommendation, not a requirement, and the
    // number is here so a change that quietly shrinks things is visible in the
    // log even though it does not fail the build.
    console.log(
      `[${locale}] ${total} controls across ${PAGES.length} pages · ${belowComfortable} under ${COMFORTABLE}px`,
    );

    expect(
      unnamed.map((u) => `${u.page}  ${u.key} — ${u.detail}`),
      "controls a screen reader cannot announce",
    ).toEqual([]);

    expect(
      failures.map((f) => `${f.page}  ${f.key} — ${f.detail}`),
      `controls failing WCAG 2.2 SC 2.5.8 (under ${MINIMUM}px and not spaced apart)`,
    ).toEqual([]);
  });
}

test("footer links stay thumb-sized", async ({ page }) => {
  // Specific, because it is the thing that was just fixed and the thing most
  // likely to be undone by someone tidying the footer's spacing. The links were
  // 19px of target in a 34px row; the gap became padding instead.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const heights = await page.evaluate(() =>
    [...document.querySelectorAll("footer nav a[href]")].map((a) => Math.round(a.getBoundingClientRect().height)),
  );

  expect(heights.length, "no footer links found — the selector has drifted").toBeGreaterThan(5);
  expect(Math.min(...heights), "a footer link is shorter than 44px again").toBeGreaterThanOrEqual(44);
});
