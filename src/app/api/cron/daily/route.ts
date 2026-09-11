import { NextResponse, type NextRequest } from "next/server";
import { expireStalePayments } from "@/lib/payments/service";
import { remindAbandonedCarts } from "@/lib/abandoned-carts";

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
 * Two jobs today, each reporting what it did:
 * - payment attempts nobody came back for are expired;
 * - carts left for a day are written about, once.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [expired, carts] = await Promise.all([
    expireStalePayments().catch((error) => {
      console.error("[cron] expireStalePayments failed", error);
      return -1;
    }),
    remindAbandonedCarts().catch((error) => {
      console.error("[cron] remindAbandonedCarts failed", error);
      return { reminded: -1 };
    }),
  ]);

  return NextResponse.json(
    { expiredPayments: expired, cartsReminded: carts.reminded, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
