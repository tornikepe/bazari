import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Is the shop up — really up, with a database behind it.
 *
 * For an uptime monitor to call once a minute. A 200 from the home page says
 * the process answers; this says it can also read, which is the thing that
 * actually fails: the last outage this shop had was `P2037 TooManyConnections`
 * with every page rendering its chrome and none of its products. So the check
 * is one cheap query, and the answer is 503 when it does not come back.
 *
 * Says nothing else. A health endpoint that lists versions and counts is a
 * reconnaissance page for anybody who finds it.
 */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, db: "ok", ms: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { ok: false, db: "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
