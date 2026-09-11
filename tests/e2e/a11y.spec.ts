import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { ADMIN, DEMO_CUSTOMER, signIn } from "./helpers";

/**
 * axe-core on every page, in both languages and both themes.
 *
 * The structure spec checks the outline a screen reader walks; this checks
 * everything else axe can see — contrast, names, roles, the ARIA that is
 * wrong rather than missing. Each is a class of fault a screenshot cannot
 * show and a hand cannot check on forty routes twice.
 *
 * WCAG 2.1 AA, which is the bar this shop holds itself to in DESIGN.md. Both
 * languages, because Georgian is the longer one and a label that fits in
 * English can overflow or be cut in it; dark mode, because every colour is a
 * token with a second value.
 */

const PUBLIC = [
  "/",
  "/catalog",
  "/catalog?category=electronics",
  "/product/ugreen-usb-c-hub-9in1",
  "/cart",
  "/favorites",
  "/login",
  "/register",
  "/forgot-password",
  "/track",
  "/about",
  "/faq",
  "/shipping",
  "/returns",
  "/warranty",
  "/privacy",
  "/terms",
  "/contact",
  "/this-page-does-not-exist",
];

const CUSTOMER = ["/account", "/checkout"];

const STAFF = [
  "/dashboard",
  "/dashboard/products",
  "/dashboard/products/new",
  "/dashboard/categories",
  "/dashboard/orders",
  "/dashboard/returns",
  "/dashboard/coupons",
  "/dashboard/customers",
  "/dashboard/staff",
  "/dashboard/pages",
  "/dashboard/settings",
];

async function audit(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // The dev-only Next.js overlay is not the shop's, and the chat panel is
    // its own widget with its own spec.
    .exclude("nextjs-portal")
    .analyze();

  // Reported as a readable list rather than a JSON blob, so a failure says
  // which rule, on which element, on which page.
  const violations = results.violations.map(
    (violation) =>
      `${path}: [${violation.id}] ${violation.help}\n` +
      violation.nodes
        .slice(0, 3)
        .map((node) => `    ${node.target.join(" ")}`)
        .join("\n"),
  );
  expect(violations, violations.join("\n\n")).toEqual([]);
}

for (const locale of ["ka", "en"] as const) {
  for (const theme of ["light", "dark"] as const) {
    test.describe(`${locale} · ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        // Otherwise axe measures the entry fade: a button at 60% opacity is
        // pink, and pink on white fails a check the button itself passes.
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.context().addCookies([
          { name: "cm_locale", value: locale, url: "http://127.0.0.1:3100" },
          { name: "bz_theme", value: theme, url: "http://127.0.0.1:3100" },
        ]);
      });

      for (const path of PUBLIC) {
        test(`${path} has no axe violations`, async ({ page }) => {
          await audit(page, path);
        });
      }

      test("the account pages have no axe violations", async ({ page }) => {
        test.skip(!DEMO_CUSTOMER.password, "CUSTOMER_PASSWORD is not set");
        await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
        for (const path of CUSTOMER) await audit(page, path);
      });

      test("the dashboard has no axe violations", async ({ page }) => {
        test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set");
        await signIn(page, ADMIN.email, ADMIN.password);
        for (const path of STAFF) await audit(page, path);
      });
    });
  }
}
