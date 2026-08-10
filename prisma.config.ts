import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `DIRECT_URL` when it is set, falling back to `DATABASE_URL`.
    //
    // Migrations must not go through a transaction-mode pooler: Prisma Migrate
    // holds a session-level advisory lock so two deploys cannot apply the same
    // migration at once, and a pooler does not keep a session between
    // statements. The failure looks like a hang, not a misconfiguration.
    //
    // Optional because a local Postgres and the CI container have no pooler.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
