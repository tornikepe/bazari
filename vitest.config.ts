import { defineConfig } from "vitest/config";

/**
 * Unit tests only — anything that needs the database or a browser belongs in
 * the Playwright suite.
 */
export default defineConfig({
  resolve: {
    // Resolves the `@/…` imports the app uses.
    tsconfigPaths: true,
    alias: {
      // `server-only` is a build-time marker Next resolves itself; under
      // Vitest it has to point at something harmless.
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
