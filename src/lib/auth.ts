import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export { hashPassword, verifyPassword } from "@/lib/auth-hash";

const SESSION_COOKIE = "cm_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

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

/** Returns the signed-in admin, or `null`. Never throws on a bad cookie. */
export async function getCurrentAdmin() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = readToken(token);
  if (!userId) return null;

  return prisma.adminUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
}
