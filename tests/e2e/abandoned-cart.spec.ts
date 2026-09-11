import { expect, test } from "@playwright/test";
import { seedCart, uniqueEmail, useEnglish } from "./helpers";

/**
 * A cart left behind.
 *
 * The browser's cart is copied to the server for a signed-in shopper, goes
 * when the cart empties, and — once it has sat for a day — is written about
 * exactly once by the daily sweep. The day is faked by moving the copy's
 * clock back; the sweep is the real route with the real secret.
 */


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

const snapshotFor = (email: string) =>
  query<{ items: unknown; remindedAt: Date | null }>(
    `SELECT s.items, s."remindedAt" FROM "CartSnapshot" s JOIN "User" u ON u.id = s."userId" WHERE u.email = $1`,
    [email],
  );

test("a signed-in cart is copied, reminded about once after a day, and forgotten when emptied", async ({
  page,
}) => {
  await useEnglish(page);

  /* A shopper of this test's own. The demo customer places an order in every
     other spec, and "they bought since" is one of the rule's reasons to stay
     quiet — a cart backdated a day would look bought against those. */
  const email = uniqueEmail("cart");
  await page.goto("/register");
  await page.getByLabel(/full name/i).fill("Cart Leaver");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/^password/i).fill("e2epassword123");
  await page.getByLabel(/confirm/i).fill("e2epassword123");
  await page.getByRole("button", { name: /sign up|create/i }).click();
  await expect(page).toHaveURL(/\/verify/);

  // ----- the copy -----
  const slug = await seedCart(page);
  await expect.poll(async () => (await snapshotFor(email)).length, { timeout: 20_000 }).toBe(1);

  // ----- too soon: nothing goes -----
  const sweep = () =>
    page.request.get("/api/cron/daily", { headers: { authorization: "Bearer e2e-cron-secret" } });
  let response = await sweep();
  expect(response.status()).toBe(200);
  expect(await snapshotFor(email)).toMatchObject([{ remindedAt: null }]);

  // ----- a day later: once -----
  await query(
    `UPDATE "CartSnapshot" SET "updatedAt" = now() - interval '25 hours'
      WHERE "userId" IN (SELECT id FROM "User" WHERE email = $1)`,
    [email],
  );
  response = await sweep();
  expect(response.status()).toBe(200);
  const [after] = await snapshotFor(email);
  expect(after!.remindedAt).not.toBeNull();

  // And not twice.
  response = await sweep();
  const body = (await response.json()) as { cartsReminded: number };
  expect(body.cartsReminded).toBe(0);

  // ----- the wrong secret, and no secret -----
  expect((await page.request.get("/api/cron/daily", { headers: { authorization: "Bearer no" } })).status()).toBe(401);
  expect((await page.request.get("/api/cron/daily")).status()).toBe(401);

  // ----- emptied: forgotten -----
  await page.goto("/cart");
  await page.getByRole("button", { name: /clear cart/i }).click();
  await expect(page.getByRole("heading", { name: /cart is empty/i })).toBeVisible();
  await expect.poll(async () => (await snapshotFor(email)).length, { timeout: 20_000 }).toBe(0);
  expect(slug).toBeTruthy();
});
