import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

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
/* Session cookie: "<userId>.<expiresAt>.<hmac>"                        */
/* ------------------------------------------------------------------ */

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function readToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresAt, signature] = parts;
  const payload = `${userId}.${expiresAt}`;

  const expected = Buffer.from(sign(payload), "hex");
  const provided = Buffer.from(signature, "hex");
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  if (Number(expiresAt) < Date.now()) return null;

  return userId;
}

export async function createSession(userId: string) {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `${userId}.${expiresAt}`;
  const store = await cookies();

  store.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  role: "customer" | "admin";
  emailVerified: boolean;
};

/** The signed-in user, or `null`. Never throws on a malformed cookie. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = readToken(token);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      city: true,
      address: true,
      role: true,
      emailVerified: true,
    },
  });
}

/**
 * The signed-in user, but only when they're staff.
 *
 * Every admin Server Action calls this rather than trusting the dashboard
 * layout's redirect — actions are reachable by direct POST.
 */
export async function getCurrentAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

/** Where a user belongs after signing in. */
export function homeFor(role: "customer" | "admin") {
  return role === "admin" ? "/dashboard" : "/account";
}
