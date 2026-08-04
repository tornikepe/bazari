import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, getProvider, isProviderId, randomToken } from "@/lib/oauth";
import { consume, clientIp } from "@/lib/rate-limit";

/**
 * Starts a social sign-in: mints the CSRF state and the PKCE verifier, parks
 * both in short-lived cookies, and sends the visitor to the provider.
 *
 * The two secrets are stored in cookies rather than in a server-side session
 * because there is no server-side session yet — that is the entire point of
 * being here. They are `httpOnly` so no script can read them, `sameSite: lax`
 * so they survive the top-level redirect back from the provider (`strict`
 * would not, and the callback would fail for everyone), and they expire in ten
 * minutes: long enough to sign in, short enough that an abandoned attempt is
 * not still valid tomorrow.
 */

const FLOW_MAX_AGE = 10 * 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerParam } = await params;
  if (!isProviderId(providerParam)) return NextResponse.redirect(new URL("/login", request.url));

  const provider = getProvider(providerParam);
  // Not configured is a 404-shaped answer, not an error page: this deployment
  // simply does not offer that button.
  if (!provider) return NextResponse.redirect(new URL("/login", request.url));

  // The same limiter the password form uses. Without it this endpoint is a
  // free redirect generator pointed at Google.
  const throttle = await consume(`oauth:ip:${await clientIp()}`, 20, 15 * 60);
  if (!throttle.ok) return NextResponse.redirect(new URL("/login?error=rate-limited", request.url));

  const state = randomToken();
  const verifier = randomToken();

  // Validated the same way the password form validates it — an unchecked
  // `next` is an open redirect, and it is about to make a round trip through
  // a third party and come back.
  const requested = request.nextUrl.searchParams.get("next") ?? "";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "";

  const response = NextResponse.redirect(authorizeUrl(provider, { state, verifier }));

  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: FLOW_MAX_AGE,
  };

  response.cookies.set("bz_oauth_state", state, options);
  response.cookies.set("bz_oauth_verifier", verifier, options);
  response.cookies.set("bz_oauth_next", next, options);

  return response;
}
