import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/rate-limit";
import { normalisePath, recordView } from "@/lib/traffic";

/**
 * The beacon a page sends when it is opened.
 *
 * `sendBeacon` from the browser, one small POST per navigation, answered with
 * 204 and nothing else. The address and the user agent are read from the
 * request here and go straight into a keyed hash — see `traffic.ts` — and are
 * not written anywhere as themselves.
 *
 * Never fails loudly: a page is counted or it is not, and the page must not
 * know which. The route does not read cookies, so a signed-in shopper is
 * counted exactly like a stranger.
 */
export async function POST(request: NextRequest) {
  let path: string | null = null;
  try {
    const body = (await request.json()) as { path?: unknown };
    path = normalisePath(String(body?.path ?? ""));
  } catch {
    path = null;
  }
  if (!path) return new NextResponse(null, { status: 204 });

  try {
    await recordView(path, await clientIp(), request.headers.get("user-agent") ?? "");
  } catch (error) {
    console.error("[traffic] could not count a view", error);
  }

  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
