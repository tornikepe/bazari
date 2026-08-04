import { expect, test, type Page } from "@playwright/test";
import { ADMIN, DEMO_CUSTOMER, VIEWER, readProductFlag, signIn } from "./helpers";

/**
 * The read-only staff role.
 *
 * What these are actually about is the difference between *hidden* and
 * *forbidden*. Not rendering a button is presentation; the guard is
 * `getCurrentAdmin` inside each Server Action. The last test proves that by
 * replaying a real mutation — captured off the wire while an admin performs it
 * — using the viewer's session, which is what anyone with devtools open could
 * do in about a minute.
 */

test.skip(!VIEWER.password || !ADMIN.password, "staff passwords are not set in the environment");

/**
 * The first product id linked from the products table.
 *
 * The length floor is not decoration: `/dashboard/products/new` is a link on
 * this same page and, for an admin, it is the *first* one — a looser pattern
 * captures the literal string "new", which then reads back from the database
 * as null and fails the test somewhere far away from the actual mistake.
 * Prisma's cuids are 25 characters.
 */
async function firstProductId(page: Page) {
  const id = await page.evaluate(async () => {
    const res = await fetch("/dashboard/products", { headers: { Accept: "text/html" } });
    return (await res.text()).match(/\/dashboard\/products\/([a-z0-9]{20,})/)?.[1] ?? null;
  });
  if (!id) throw new Error("no product row found on the dashboard");
  return id;
}

/** Read from the database, not from the page that is under test. */
const isActive = (id: string) => readProductFlag(id, "isActive");

test("a viewer reaches the dashboard, a customer does not", async ({ page }) => {
  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.context().clearCookies();
  await signIn(page, DEMO_CUSTOMER.email, DEMO_CUSTOMER.password);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/account/);
});

test("a viewer sees every page an admin sees", async ({ page }) => {
  await signIn(page, VIEWER.email, VIEWER.password);

  for (const path of [
    "/dashboard",
    "/dashboard/products",
    "/dashboard/categories",
    "/dashboard/orders",
    "/dashboard/customers",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), `${path} should render for a viewer`).toBe(200);
    await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
  }
});

test("a viewer is told why the controls are gone", async ({ page }) => {
  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/products");

  await expect(page.getByText(/view-only|მხოლოდ ნახვის/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /new product|ახალი პროდუქტი/i })).toHaveCount(0);
});

test("an admin has the controls and no notice", async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/products");

  await expect(
    page.getByRole("link", { name: /new product|ახალი პროდუქტი/i }).first(),
  ).toBeVisible();
  await expect(page.getByText(/view-only|მხოლოდ ნახვის/i)).toHaveCount(0);
});

test("a viewer's session is refused by the action itself, not just by the UI", async ({
  page,
  context,
}) => {
  /* ---- 1. watch an admin perform the real mutation ------------------- */
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/products");

  const productId = await firstProductId(page);
  const activeBefore = await isActive(productId);

  let captured: { url: string; headers: Record<string, string>; body: string } | null = null;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      captured = {
        url: request.url(),
        headers: request.headers(),
        body: request.postData() ?? "",
      };
    }
  });

  await page.goto("/dashboard/products");
  await page
    .getByRole("switch", { name: /active|აქტიური/i })
    .first()
    .click();

  await expect.poll(() => captured !== null, { timeout: 10_000 }).toBe(true);
  const request = captured!;

  // Put the product back the way it was, so the suite stays order-independent.
  await expect.poll(() => isActive(productId)).toBe(!activeBefore);
  await page.goto("/dashboard/products");
  await page
    .getByRole("switch", { name: /active|აქტიური/i })
    .first()
    .click();
  await expect.poll(() => isActive(productId)).toBe(activeBefore);

  /* ---- 2. replay it as the viewer ------------------------------------ */
  await context.clearCookies();
  await signIn(page, VIEWER.email, VIEWER.password);
  await page.goto("/dashboard/products");

  // Same URL, same action id, same payload — only the session cookie differs,
  // and the cookie jar is now the viewer's.
  const replay = await page.request.post(request.url, {
    headers: {
      "next-action": request.headers["next-action"],
      "content-type": request.headers["content-type"] ?? "text/plain;charset=UTF-8",
    },
    data: request.body,
  });

  // The action is allowed to answer 200 — it returns `{ ok: false }` rather
  // than throwing, which is the right shape for a form. What must not have
  // happened is the write.
  expect(replay.status()).toBeLessThan(500);
  expect(await isActive(productId)).toBe(activeBefore);
});
