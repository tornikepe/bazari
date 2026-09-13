import "server-only";

import { headers } from "next/headers";
import { SITE_URL } from "@/lib/site";

/**
 * Where this request came in, as an origin — for a link that has to bring
 * the shopper back to the same server that sent them away.
 *
 * `SITE_URL` is the canonical address and the right thing for an email or a
 * sitemap. It is the wrong thing here: a gateway redirect built from it on a
 * preview deployment, or on the test server on port 3100, sends the shopper
 * back to production or to nothing. The request knows where it arrived;
 * behind Vercel's proxy that is the forwarded pair, and elsewhere the host.
 */
export async function requestOrigin(): Promise<string> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host");
  if (!host) return SITE_URL;
  const proto = store.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
