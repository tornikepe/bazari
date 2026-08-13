import { headers } from "next/headers";

/**
 * Whether the cookies this response sets should carry `Secure`.
 *
 * `process.env.NODE_ENV === "production"` was the rule, and it is wrong in one
 * situation that matters: a production *build* served over plain http, which
 * is what `next start` does locally and what the end-to-end suite runs
 * against. A `Secure` cookie sent over http is dropped by the browser, so the
 * session never survives the response that created it.
 *
 * Chromium hides this. It treats loopback as a trustworthy origin and keeps
 * the cookie anyway; **WebKit does not**, so signing in worked and the very
 * next request arrived at the sign-in page. That is the same shape as the
 * `upgrade-insecure-requests` fault in `proxy.ts` — the engine that is
 * lenient about localhost is the one most people develop in.
 *
 * The rule below can only ever *remove* `Secure` from a request that is
 * demonstrably plain http: a proxy that says so, or no proxy at all and a
 * loopback host. Anything else — including a deployment whose proxy sets no
 * headers — keeps it. Weakening a real deployment's cookies to make a test
 * pass would be a bad trade.
 */
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// Not `useSecureCookies`: a `use` prefix makes ESLint read it as a React hook
// and refuse to see it called from an async server function.
export async function secureCookies(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return false;

  const header = await headers();

  // A proxy that terminates TLS says what the browser actually spoke. The
  // first value is the client's; the rest are hops.
  const forwarded = header.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";

  return !LOOPBACK.test(header.get("host") ?? "");
}

/** The same question, for the middleware and route handlers, which hold a request. */
export function secureCookiesFor(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return false;

  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";

  return !LOOPBACK.test(request.headers.get("host") ?? "");
}
