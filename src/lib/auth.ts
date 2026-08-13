import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { secureCookies } from "@/lib/cookie-security";
import { prisma } from "@/lib/prisma";
import { isStaff, type Role } from "@/lib/auth-roles";

export { hashPassword, verifyPassword } from "@/lib/auth-hash";

const SESSION_COOKIE = "bz_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET is not set — copy .env.example to .env");
  }
  return value;
}

/* ------------------------------------------------------------------ */
/* Session cookie: "<userId>.<sessionVersion>.<expiresAt>.<hmac>"       */
/*                                                                      */
/* Stateless and self-verifying, so a request costs no session lookup    */
/* and there is no session table to keep. The price of that is that a    */
/* cookie cannot be withdrawn once issued — which is the wrong answer    */
/* to "I think someone is in my account", the exact moment a password    */
/* reset happens.                                                        */
/*                                                                       */
/* `sessionVersion` buys revocation back. It is signed into the cookie    */
/* and compared against the column on every request, so bumping the       */
/* column invalidates every cookie for that user at once. The comparison  */
/* is free: `getCurrentUser` already selects the row.                     */
/* ------------------------------------------------------------------ */

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function readToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [userId, version, expiresAt, signature] = parts;
  const payload = `${userId}.${version}.${expiresAt}`;

  const expected = Buffer.from(sign(payload), "hex");
  const provided = Buffer.from(signature, "hex");
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  if (Number(expiresAt) < Date.now()) return null;

  const sessionVersion = Number(version);
  if (!Number.isInteger(sessionVersion)) return null;

  return { userId, sessionVersion };
}

export async function createSession(userId: string, sessionVersion = 0) {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${sessionVersion}.${expiresAt}`;
  const store = await cookies();

  store.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookies(),
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/* ------------------------------------------------------------------ */
/* Current user                                                        */
/* ------------------------------------------------------------------ */

export type { Role } from "@/lib/auth-roles";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  role: Role;
  emailVerified: boolean;
};

export { isStaff } from "@/lib/auth-roles";

/** The signed-in user, or `null`. Never throws on a malformed cookie. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claim = readToken(token);
  if (!claim) return null;

  const user = await prisma.user.findUnique({
    where: { id: claim.userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      city: true,
      address: true,
      role: true,
      emailVerified: true,
      sessionVersion: true,
    },
  });
  if (!user) return null;

  // The signature proves the cookie was minted here; this proves it has not
  // been revoked since. A password reset bumps the column, and every cookie
  // carrying the old number stops working on the next request.
  if (user.sessionVersion !== claim.sessionVersion) return null;

  // `sessionVersion` is a revocation detail and no caller has any business
  // with it, so it does not travel further than this function.
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    city: user.city,
    address: user.address,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

/**
 * Invalidates every session cookie this user holds, including the one making
 * the request. Called wherever the account's credentials change.
 */
export async function revokeSessions(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return user.sessionVersion;
}

/**
 * The signed-in user, but only when they can *change* things.
 *
 * Every admin Server Action calls this rather than trusting the dashboard
 * layout's redirect — actions are reachable by direct POST, so hiding a button
 * from a `viewer` is presentation, and this is the part that actually holds.
 */
export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

/**
 * The signed-in user when they may *see* the dashboard — either staff role.
 *
 * Deliberately a separate function from `getCurrentAdmin` rather than a
 * parameter on it. A read guard and a write guard that share one call site are
 * one careless default away from letting a viewer through to a mutation, and
 * the compiler cannot tell the two apart if they return the same shape.
 */
export async function getCurrentStaff() {
  const user = await getCurrentUser();
  return user && isStaff(user.role) ? user : null;
}

/** Where a user belongs after signing in. */
export function homeFor(role: Role) {
  return isStaff(role) ? "/dashboard" : "/account";
}
