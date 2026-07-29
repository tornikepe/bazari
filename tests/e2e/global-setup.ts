import { Client } from "pg";

/**
 * Clears the rate-limit counters before a run.
 *
 * The limits are real and shared, so a suite that signs in wrongly on purpose
 * and requests several password resets will exhaust them and fail the *next*
 * run for reasons that have nothing to do with the code under test.
 *
 * Uses `pg` rather than the Prisma client because Playwright loads this file
 * with the CommonJS loader, and the generated client is ESM.
 */
export default async function globalSetup() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query('DELETE FROM "RateLimit"');
    if (result.rowCount) console.log(`[e2e] cleared ${result.rowCount} rate-limit counter(s)`);
  } catch (error) {
    // Never block the suite on housekeeping.
    console.warn("[e2e] could not clear rate limits:", (error as Error).message);
  } finally {
    await client.end().catch(() => {});
  }
}
