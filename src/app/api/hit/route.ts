import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/rate-limit";
import { normalisePath, recordProductEvents, recordView } from "@/lib/traffic";
import { isProductEventKind } from "@/lib/product-events";

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
  const done = new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

  let body: { path?: unknown; event?: unknown; productIds?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return done;
  }

  // A product step — a card opened, a line put in the cart, an order looked
  // at — rather than a page. Same beacon, same route, same nothing kept.
  if (isProductEventKind(body.event)) {
    const ids = Array.isArray(body.productIds) ? body.productIds.filter((id): id is string => typeof id === "string") : [];
    try {
      await recordProductEvents(body.event, ids);
    } catch (error) {
      console.error("[traffic] could not count a product event", error);
    }
    return done;
  }

  const path = normalisePath(String(body.path ?? ""));
  if (!path) return done;

  try {
    await recordView(path, await clientIp(), request.headers.get("user-agent") ?? "");
  } catch (error) {
    console.error("[traffic] could not count a view", error);
  }

  return done;
}
