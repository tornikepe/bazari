import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limiting, backed by Postgres.
 *
 * Deliberately not Redis: the app already has a database, auth endpoints are
 * low-volume, and a second managed service is a second thing to pay for and
 * keep alive. The counter is incremented inside a single atomic upsert, so two
 * simultaneous attempts cannot both read "4 of 5" and both be allowed.
 *
 * Fails **open** — if the database is unreachable the request proceeds rather
 * than locking everyone out of the site. Rate limiting is a mitigation, not
 * the thing standing between an attacker and an account.
 */

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the current window expires; 0 when `ok`. */
  retryAfter: number;
};

const ALLOWED: RateLimitResult = { ok: true, retryAfter: 0 };

/**
 * Counts one attempt against `key` and reports whether it is still allowed.
 *
 * @param key    stable identifier, e.g. `login:ip:1.2.3.4`
 * @param limit  attempts permitted per window
 * @param windowSeconds  window length
 */
export async function consume(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const cutoff = new Date(Date.now() - windowSeconds * 1000);

  try {
    // One statement: insert the first attempt, or bump the existing counter —
    // restarting it when the previous window has already expired.
    const rows = await prisma.$queryRaw<{ count: number; windowAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowAt")
      VALUES (${key}, 1, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."windowAt" < ${cutoff} THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "windowAt" = CASE
          WHEN "RateLimit"."windowAt" < ${cutoff} THEN now()
          ELSE "RateLimit"."windowAt"
        END
      RETURNING "count", "windowAt"
    `;

    const row = rows[0];
    if (!row) return ALLOWED;

    if (row.count > limit) {
      const elapsed = (Date.now() - row.windowAt.getTime()) / 1000;
      return { ok: false, retryAfter: Math.max(1, Math.ceil(windowSeconds - elapsed)) };
    }

    return ALLOWED;
  } catch (error) {
    console.error("[rate-limit] check failed, allowing the request", error);
    return ALLOWED;
  }
}

/**
 * Clears a key — call after a *successful* login so one bad password today
 * doesn't count against the same person tomorrow.
 */
export async function reset(key: string): Promise<void> {
  try {
    await prisma.rateLimit.deleteMany({ where: { key } });
  } catch {
    // Nothing to do; the window will expire on its own.
  }
}

/**
 * Best-effort client address.
 *
 * On Vercel `x-forwarded-for` is set by the platform and cannot be spoofed by
 * the client, so the left-most entry is the real caller. Off Vercel this is
 * only as trustworthy as the proxy in front of the app.
 */
export async function clientIp(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return store.get("x-real-ip")?.trim() || "unknown";
}
