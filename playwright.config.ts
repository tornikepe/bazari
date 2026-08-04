// Playwright runs its config, global setup and specs in its own Node process,
// which — unlike the Next server — does not load `.env`. Without this,
// `DATABASE_URL` is undefined here and every piece of database housekeeping
// silently no-ops. That is not hypothetical: `global-setup.ts` exists to clear
// the rate-limit counters between runs and had never once done so.
import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end suite.
 *
 * Runs against a production build on its own port, so it never collides with a
 * dev server someone has open, and so it exercises the same code path that
 * ships — the dev server's error overlay and lax compilation hide real
 * problems.
 *
 * These tests share one database, so they are written to be order-independent:
 * each creates the data it needs with a unique identifier and never asserts on
 * a global count.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Rate limits are real and shared; clear them so a rerun is not punished
  // for the previous run's deliberate failures.
  globalSetup: "./tests/e2e/global-setup.ts",
  // A shared database means no parallel writes to the same rows.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `npx next build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      // The chat launcher is only rendered when a provider is configured, so
      // the widget would be untestable without a key. This placeholder is
      // enough to render it: the suite exercises opening, closing and layout,
      // and never sends a message, so no request is ever made with it.
      //
      // Pinned to one provider rather than inherited, so the suite tests the
      // same thing on a machine that happens to have a real key in `.env`.
      GEMINI_API_KEY: "e2e-render-only",
      CHAT_PROVIDER: "gemini",
    },
  },
});
