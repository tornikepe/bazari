import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * How many connections one instance may hold.
 *
 * `PrismaPg` takes a `pg.PoolConfig`, and passing only a connection string
 * accepts node-postgres' default of **10 per pool**. On a single long-lived
 * server that is fine. On Vercel it is not: every serverless instance builds
 * its own pool, so ten warm instances ask for a hundred connections and a
 * small Postgres plan refuses long before that.
 *
 * Not hypothetical — this took the home and catalogue pages down with
 * `P2037 TooManyConnections`. The pages were correct; they just couldn't get
 * a connection.
 *
 * Not 1, either: a request often issues several queries together (the
 * assistant's shop summary runs five in one `Promise.all`), and a pool of one
 * would serialise them. Small enough that many instances fit inside the plan,
 * large enough that a request doesn't queue against itself.
 */
function poolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(configured) && configured > 0) return Math.floor(configured);

  // Dev is one process living for hours; production is many short-lived
  // instances sharing one small allowance.
  return process.env.NODE_ENV === "production" ? 3 : 5;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: poolMax(),
      // Hand connections back quickly: an instance that served one request and
      // went idle must not sit on a connection another instance is waiting for.
      idleTimeoutMillis: 10_000,
      // Fail fast when the pool is saturated. Without this the request hangs
      // until the platform's own timeout, turning a slow moment into a pile-up
      // of requests all holding their place in the queue.
      connectionTimeoutMillis: 8_000,
    }),
  });
}

// Reuse one client across hot reloads in dev, otherwise every reload opens a
// new connection pool and Postgres eventually refuses new connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
