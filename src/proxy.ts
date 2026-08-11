import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers, including a nonce-based Content Security Policy.
 *
 * In this version of Next the middleware file is `proxy.ts` — the old
 * `middleware.ts` name no longer applies.
 *
 * A fresh nonce per request is what lets the CSP forbid inline script without
 * breaking Next's own bootstrap or the pre-paint theme script in the root
 * layout, which reads the nonce back out of `x-nonce`.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  /**
   * Whether this response is actually travelling over TLS.
   *
   * Not `!isDev`: the end-to-end suite runs a *production* build over plain
   * http, so anything keyed on the build mode is wrong there — and one header
   * below is only safe to send when there is really a TLS endpoint to upgrade
   * to. Vercel terminates TLS and forwards the original scheme in
   * `x-forwarded-proto`; a direct request carries its own.
   */
  const forwarded = request.headers.get("x-forwarded-proto");
  const isHttps = forwarded
    ? forwarded.split(",")[0]!.trim() === "https"
    : request.nextUrl.protocol === "https:";

  const csp = [
    `default-src 'self'`,
    // 'strict-dynamic' lets the nonced bootstrap load the rest of the chunks.
    // React needs eval in development for readable error stacks; not in prod.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React writes `style` attributes (the hero gradient, for one), and those
    // are governed by style-src. Inline *style* is a far smaller risk than
    // inline script, so this stays permissive on purpose.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    // Same-origin only: server actions post back here and nothing else.
    `connect-src 'self'${isDev ? " ws: http://localhost:*" : ""}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    /**
     * Only over TLS, and this one is not cosmetic.
     *
     * `upgrade-insecure-requests` rewrites every http subresource to https.
     * Chromium exempts localhost, so on plain http it appears to do nothing.
     * WebKit does not exempt it — it dutifully upgrades every stylesheet,
     * script and server action on `http://127.0.0.1:3100` to a port with no
     * TLS listener, and each one fails with a TLS error. The page renders
     * unstyled, never hydrates, and every form silently does nothing.
     *
     * That is exactly what the WebKit project found the first time it ran, and
     * it read as two dozen unrelated layout and focus bugs. There is nothing to
     * upgrade *to* without TLS, so sending it there was never right.
     */
    ...(isHttps ? [`upgrade-insecure-requests`] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  // Belt and braces alongside frame-ancestors, for older browsers.
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Nothing here needs a camera, a microphone or a location.
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Only meaningful over HTTPS; Vercel terminates TLS, local dev is untouched.
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  matcher: [
    {
      // Static assets and the image optimiser don't need a per-request nonce,
      // and prefetches would only churn them.
      source: "/((?!api|_next/static|_next/image|favicon.ico|products).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
