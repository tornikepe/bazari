import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { expireStalePayments } from "@/lib/payments/service";
import { remindAbandonedCarts } from "@/lib/abandoned-carts";
import { sweepSpentRows } from "@/lib/housekeeping";

/**
 * The once-a-day housekeeping, for a scheduler to call.
 *
 * Vercel's cron calls it with `Authorization: Bearer $CRON_SECRET` — the
 * schedule is in `vercel.json` — and anything else can call it the same way:
 * a `curl` in a crontab, a GitHub Action. Without the secret set, the route
 * refuses everything, which is the safe way for an unconfigured deployment
 * to behave: a sweep that anybody on the internet could trigger is a sweep
 * that gets triggered.
 *
 * Three jobs today, each reporting what it did:
 * - payment attempts nobody came back for are expired;
 * - carts left for a day are written about, once;
 * - the rows that were scaffolding rather than record — spent rate-limit
 *   counters, spent one-time codes — are swept.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });

  /* Compared the way every other secret in this app is compared. A plain
     `!==` returns as soon as two bytes differ, and the shop's own session
     cookies, order cookies, passwords and one-time codes all go through
     `timingSafeEqual` for that reason — this was the one that did not. The
     length check first, because `timingSafeEqual` throws on a mismatch
     rather than returning false. */
  const offered = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  if (offered.length !== wanted.length || !timingSafeEqual(offered, wanted)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [expired, carts, swept] = await Promise.all([
    expireStalePayments().catch((error) => {
      console.error("[cron] expireStalePayments failed", error);
      return -1;
    }),
    remindAbandonedCarts().catch((error) => {
      console.error("[cron] remindAbandonedCarts failed", error);
      return { reminded: -1 };
    }),
    sweepSpentRows().catch((error) => {
      console.error("[cron] sweepSpentRows failed", error);
      return { rateLimits: -1, tokens: -1 };
    }),
  ]);

  return NextResponse.json(
    {
      expiredPayments: expired,
      cartsReminded: carts.reminded,
      swept,
      at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
