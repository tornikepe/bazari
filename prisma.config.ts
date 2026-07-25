import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // SQLite file path is resolved relative to the project root (see .env.example).
    url: process.env["DATABASE_URL"],
  },
});
