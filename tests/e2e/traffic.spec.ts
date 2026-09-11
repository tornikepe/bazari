import { expect, test } from "@playwright/test";
import { ADMIN, signIn, useEnglish } from "./helpers";

/**
 * Page views, counted without a cookie.
 *
 * Opening the shop sends one beacon per page; the dashboard's traffic page
 * shows the count. The test checks both halves, and the two things that must
 * be true of the counting: it sets no cookie, and one browser opening two
 * pages is one visitor, not two.
 */

test.skip(!ADMIN.password, "ADMIN_PASSWORD is not set in the environment");

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("[e2e] DATABASE_URL is not set");
  const { Client } = await import("pg");
  const client = new Client({ connectionString });
  try {
    await client.connect();
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end().catch(() => {});
  }
}

const totals = async () => {
  const [row] = await query<{ views: string; visitors: string }>(
    `SELECT (SELECT COALESCE(SUM(views), 0) FROM "PageView") AS views,
            (SELECT COUNT(*) FROM "DailyVisitor") AS visitors`,
  );
  return { views: Number(row!.views), visitors: Number(row!.visitors) };
};

test("a page opened by a stranger is counted, and nothing about the stranger is kept", async ({
  page,
}) => {
  await useEnglish(page);
  const before = await totals();

  let beacons = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/hit")) beacons += 1;
  });

  await page.goto("/catalog");
  await page.goto("/about");
  await expect.poll(() => beacons).toBeGreaterThanOrEqual(2);

  // Two views; and one visitor at most, because it is one browser — the
  // second page must not mint a second person.
  // Patient: the first beacon of a run opens the server's pool to a database
  // that may be a continent away, and the two upserts sit behind that.
  await expect
    .poll(async () => (await totals()).views, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(before.views + 2);
  const after = await totals();
  expect(after.visitors - before.visitors).toBeLessThanOrEqual(1);

  // No cookie was set by counting: the only cookie is the one the reader
  // chose — the language.
  const cookies = await page.context().cookies();
  expect(cookies.map((c) => c.name).sort()).toEqual(["cm_locale"]);

  // ----- the shop sees the number -----
  await signIn(page, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/traffic?range=7");
  await expect(page.getByRole("heading", { name: /^traffic/i })).toBeVisible();
  const pages = page.locator("ol li");
  await expect(pages.filter({ hasText: "/catalog" })).toHaveCount(1);
  await expect(pages.filter({ hasText: "/about" })).toHaveCount(1);
});
