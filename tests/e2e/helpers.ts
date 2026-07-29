import type { Page } from "@playwright/test";

/** Seeded accounts. The admin password comes from the environment. */
export const DEMO_CUSTOMER = { email: "user@bazari.ge", password: "user1234" };
export const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? "admin@bazari.ge",
  password: process.env.ADMIN_PASSWORD ?? "",
};

/** A unique address per run, so re-runs never collide on the unique email. */
export function uniqueEmail(prefix = "e2e") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/email|ელფოსტა/i).first().fill(email);
  await page.getByLabel(/password|პაროლი/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|შესვლა/i }).click();
}

/**
 * Puts one product in the cart without clicking through the catalogue.
 *
 * The cart lives in localStorage, so seeding it directly keeps checkout tests
 * about checkout rather than about the add-to-cart button, which has its own
 * test.
 */
export async function seedCart(page: Page, quantity = 1) {
  await page.goto("/");
  const product = await page.evaluate(async () => {
    const res = await fetch("/catalog", { headers: { Accept: "text/html" } });
    const html = await res.text();
    return html.match(/\/product\/([a-z0-9-]+)/)?.[1] ?? null;
  });
  if (!product) throw new Error("no product found in the catalogue");

  await page.goto(`/product/${product}`);
  const addButton = page.getByRole("button", { name: /add to cart|კალათაში/i }).first();
  for (let i = 0; i < quantity; i++) await addButton.click();

  return product;
}

/** English keeps the selectors readable regardless of the default locale. */
export async function useEnglish(page: Page) {
  await page.context().addCookies([
    { name: "cm_locale", value: "en", url: "http://127.0.0.1:3100" },
  ]);
}
