/**
 * Password hashing, kept free of `server-only` and `next/headers` so the seed
 * script (plain tsx, no Next.js runtime) can import it too.
 *
 * scrypt is used instead of bcrypt/argon2 to avoid a native dependency.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(plain: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(plain: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;

  const actual = scryptSync(plain, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuffer.length) return false;

  return timingSafeEqual(actual, expectedBuffer);
}
