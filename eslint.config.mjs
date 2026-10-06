import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not ours to lint. `.claude/worktrees` holds whole checkouts of this
    // repository that an agent is working in, and linting them reported
    // thousands of problems in copies of files — `npm run lint` was
    // unreadable, and so unused, on a developer's own machine. CI never saw
    // it because a fresh checkout has no worktrees in it.
    ".claude/**",
    // Written by `prisma generate`, not by hand.
    "src/generated/**",
    // Database dumps.
    "backups/**",
  ]),
]);

export default eslintConfig;
