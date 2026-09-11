import { expect, test } from "@playwright/test";

/** The endpoint an uptime monitor pings: up means the database answered. */
test("the health check says the database is reachable, and nothing else", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as Record<string, unknown>;
  expect(body.ok).toBe(true);
  expect(body.db).toBe("ok");
  // No versions, no counts, no names: nothing worth finding.
  expect(Object.keys(body).sort()).toEqual(["db", "ms", "ok"]);
});
