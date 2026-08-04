import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, homeFor } from "@/lib/auth";
import { hashPassword } from "@/lib/auth-hash";
import { exchangeCode, getProvider, isProviderId, randomToken } from "@/lib/oauth";

/**
 * Comes back from the provider, checks everything, and signs the visitor in.
 *
 * The order of the checks is the security of the whole flow, so it is worth
 * reading top to bottom: state before code, code before profile, verified
 * email before any database write.
 */

/** Constant-time, and never throws on a length mismatch. */
function sameToken(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function failure(request: NextRequest, reason: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
  // Whatever went wrong, the flow is over. Leaving a valid state cookie behind
  // is exactly the thing state exists to prevent.
  for (const name of ["bz_oauth_state", "bz_oauth_verifier", "bz_oauth_next"]) {
    response.cookies.delete(name);
  }
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerParam } = await params;
  if (!isProviderId(providerParam)) return failure(request, "unavailable");

  const provider = getProvider(providerParam);
  if (!provider) return failure(request, "unavailable");

  // The visitor pressed "cancel" at the provider. Not an error worth shouting
  // about — they simply changed their mind.
  if (request.nextUrl.searchParams.get("error")) {
    return failure(request, "cancelled");
  }

  const code = request.nextUrl.searchParams.get("code") ?? "";
  const returnedState = request.nextUrl.searchParams.get("state") ?? "";

  const storedState = request.cookies.get("bz_oauth_state")?.value ?? "";
  const verifier = request.cookies.get("bz_oauth_verifier")?.value ?? "";

  // 1. CSRF. Without this, a crafted callback URL carrying an attacker's code
  //    silently links their identity to whoever opens it.
  if (!code || !storedState || !sameToken(storedState, returnedState)) {
    return failure(request, "state");
  }
  if (!verifier) return failure(request, "state");

  // 2. Redeem the code. PKCE means an intercepted code is useless without the
  //    verifier, which never left this server.
  const profile = await exchangeCode(provider, { code, verifier });

  // 3. `null` here covers both a failed exchange and a profile this app will
  //    not accept — an unverified Google address, or a Facebook account with
  //    no confirmed email. Matching accounts by email is only safe because
  //    this check exists, so it is a refusal, not a fallback.
  if (!profile) return failure(request, "unverified");

  const email = profile.email.trim().toLowerCase();
  if (!email.includes("@")) return failure(request, "unverified");

  const existing = await prisma.user.findUnique({ where: { email } });

  let user = existing;
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: profile.name,
        // A random password nobody holds, rather than an empty string or a
        // null column. It means every row in this table has the same shape,
        // the password comparison has nothing special to handle, and the
        // account is unreachable through the password form until its owner
        // sets one via "forgot password".
        password: hashPassword(randomToken()),
        // Never from the provider — a social sign-in cannot mint staff.
        role: "customer",
        // The provider has confirmed the address; that is what step 3 checked.
        emailVerified: true,
      },
    });
  } else if (!user.emailVerified) {
    // Signing in through a provider that has confirmed the address is at
    // least as strong as the emailed code this app would otherwise send.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
  }

  await createSession(user.id);

  const requested = request.cookies.get("bz_oauth_next")?.value ?? "";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : homeFor(user.role);

  const response = NextResponse.redirect(new URL(next, request.url));
  for (const name of ["bz_oauth_state", "bz_oauth_verifier", "bz_oauth_next"]) {
    response.cookies.delete(name);
  }
  return response;
}
