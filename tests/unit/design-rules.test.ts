import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The rules in `DESIGN.md`, held to the source.
 *
 * Every one of them was already true when this was written — that is the
 * point. A design decision written down and not enforced lasts until the next
 * page, which is exactly what happened four times over: four page paddings,
 * thirteen hand-written page titles, six card paddings, four tables. Nobody
 * chose any of them; each was a copy of whatever page was open at the time.
 *
 * So each rule below is a pattern that must not come back, and every exception
 * is named with its reason. Adding a page that breaks one of these is not
 * forbidden — it is a decision, and the way to make it is to add the file here
 * and say why. What is forbidden is doing it silently.
 *
 * A source-text test rather than a rendered one because it is about what the
 * code *says*: a page can render correctly today and still have retyped a rule
 * that will drift tomorrow. The browser cannot see the difference; this can.
 */

const ROOT = new URL("../../", import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    else if (entry.name.endsWith(".tsx")) found.push(path);
  }
  return found;
}

/** Every component and route, but not the generated Prisma client. */
const FILES = [...sourceFiles("src/app"), ...sourceFiles("src/components")].map((path) => ({
  path: relative("", path).split("\\").join("/"),
  text: readFileSync(join(ROOT, path), "utf8"),
}));

/** Each `className="…"` or `className={`…`}` in a file, as plain text. */
function classNames(text: string): string[] {
  return [...text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

const has = (classes: string, name: string) =>
  new RegExp(String.raw`(?<![-\w:])${name}(?![-\w])`).test(classes);

/**
 * Reports every file that breaks a rule, minus the ones allowed to.
 *
 * Returns the offenders rather than asserting, so each rule below can name its
 * own exceptions and say why they are exceptions — a bare list of paths in an
 * `expect` teaches nobody anything.
 */
function offenders(rule: (file: (typeof FILES)[number]) => boolean, allowed: string[]) {
  return FILES.filter((file) => rule(file) && !allowed.includes(file.path)).map((f) => f.path);
}

describe("one vertical rhythm", () => {
  it("no page sets its own top and bottom padding", () => {
    expect(
      offenders(
        (file) =>
          classNames(file.text).some(
            (classes) => has(classes, "page-container") && /(?<![-\w:])py-\d/.test(classes),
          ),
        [
          // The landing page is bands rather than a column, and each band pays
          // for its own space.
          "src/app/(shop)/page.tsx",

          // Chrome, not pages. Both align to the page container because the
          // content above them does; neither is a page with a rhythm to keep.
          "src/components/layout/Footer.tsx",
          "src/components/product/StickyBuyBar.tsx",
        ],
      ),
    ).toEqual([]);
  });
});

describe("one card", () => {
  it("no card sets its own padding", () => {
    expect(
      offenders(
        (file) =>
          classNames(file.text).some(
            (classes) =>
              has(classes, "card") &&
              /(?<![-\w:])p[xy]?-\d/.test(classes.replace(/card-pad(-\w+)?/g, "")),
          ),
        [],
      ),
    ).toEqual([]);
  });

  it("no card draws its own header bar", () => {
    expect(
      offenders((file) => file.text.includes("border-b border-line px-5 py-3.5"), []),
    ).toEqual([]);
  });
});

describe("one table", () => {
  it("every table is the table", () => {
    expect(
      offenders(
        (file) => [...file.text.matchAll(/<table\b[^>]*>/g)].some((m) => !/\btable\b/.test(m[0])),
        [],
      ),
    ).toEqual([]);
  });

  it("no table cell sets its own padding", () => {
    expect(
      offenders(
        (file) =>
          [...file.text.matchAll(/<t[dh]\b[^>]*>/g)].some((m) => /(?<![-\w:])p[xy]-\d/.test(m[0])),
        [],
      ),
    ).toEqual([]);
  });
});

describe("one page header", () => {
  it("no page writes its own title", () => {
    expect(
      offenders((file) => file.text.includes("<h1"), [
        // The component itself.
        "src/components/layout/PageHeader.tsx",

        // The landing page: a display-scale headline, not a page title.
        "src/app/(shop)/page.tsx",

        // The record template — the title belongs beside the photo rather than
        // above both columns.
        "src/app/(shop)/product/[slug]/page.tsx",

        // The notice template: one centred card and no page furniture.
        "src/app/not-found.tsx",
        "src/app/error.tsx",
        "src/app/(shop)/error.tsx",
        "src/app/(shop)/order/[number]/page.tsx",
        "src/components/auth/AuthCard.tsx",
        "src/components/checkout/CheckoutForm.tsx",

        // The one page whose header is about who is reading it, and carries
        // their initials.
        "src/components/account/AccountIdentity.tsx",
      ]),
    ).toEqual([]);
  });
});

describe("one way to show a row of figures", () => {
  it("no page draws its own hairline figure grid", () => {
    expect(
      offenders((file) => file.text.includes("grid gap-px border border-line bg-line"), [
        // The component itself.
        "src/components/ui/Figures.tsx",

        // Not figures: the 404 page's suggestions, which are links.
        "src/app/not-found.tsx",
      ]),
    ).toEqual([]);
  });
});
