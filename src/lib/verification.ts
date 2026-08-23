import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { TokenPurpose } from "@/generated/prisma/enums";

const CODE_LENGTH = 6;
const TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

/**
 * Codes are stored hashed, never in plain text, so a leaked database can't be
 * replayed against either flow. SHA-256 rather than scrypt is deliberate: the
 * code is short-lived, rate-limited and high-entropy enough for 15 minutes,
 * and verification has to stay fast.
 */
function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode() {
  // `randomInt` is cryptographically secure, unlike Math.random.
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * Issues a fresh code, invalidating any earlier unused one for the same
 * purpose so only the newest email works.
 *
 * There is no mail provider wired up in this demo, so the caller decides how
 * to surface the returned code (the UI shows it in a clearly-labelled panel).
 * In production this is where the send would happen, and the code would stop
 * being returned.
 */
export async function issueCode(userId: string, purpose: TokenPurpose) {
  await prisma.verificationToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateCode();

  await prisma.verificationToken.create({
    data: {
      userId,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60 * 1000),
    },
  });

  return { code, expiresInMinutes: TTL_MINUTES };
}

export type CodeCheck =
  | { ok: true; userId: string }
  | { ok: false; reason: "invalid" | "expired" | "too-many-attempts" };

/**
 * Verifies a submitted code and consumes it on success.
 *
 * Failed attempts are counted on the token itself, so guessing is bounded even
 * though the code is only six digits.
 */
export async function consumeCode(
  email: string,
  purpose: TokenPurpose,
  code: string,
): Promise<CodeCheck> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!user) return { ok: false, reason: "invalid" };

  const token = await prisma.verificationToken.findFirst({
    where: { userId: user.id, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return { ok: false, reason: "invalid" };

  if (token.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too-many-attempts" };
  if (token.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  const expected = Buffer.from(token.codeHash, "hex");
  const provided = Buffer.from(hashCode(code.trim()), "hex");
  const matches = expected.length === provided.length && timingSafeEqual(expected, provided);

  if (!matches) {
    await prisma.verificationToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: "invalid" };
  }

  await prisma.verificationToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  });

  return { ok: true, userId: user.id };
}

/**
 * A one-time link token for a staff invitation.
 *
 * Not a six-digit code: this one travels in a URL rather than being typed, so
 * it can afford to be long — and it has to be, because a code short enough to
 * read out is short enough to guess when it is good for two days rather than
 * fifteen minutes.
 *
 * Stored hashed like every other token here, and any earlier unused invite for
 * the same person is spent first so only the newest link works.
 */
export async function issueInvite(userId: string, hours = 48) {
  await prisma.verificationToken.updateMany({
    where: { userId, purpose: "staff_invite", usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString("base64url");

  await prisma.verificationToken.create({
    data: {
      userId,
      purpose: "staff_invite",
      codeHash: hashCode(token),
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
    },
  });

  return token;
}

/**
 * Spends an invitation and reports whose it was.
 *
 * Deliberately not `consumeCode`: that one counts attempts and locks after
 * five, which is right for a code somebody types and wrong for a link they
 * click — a mistyped URL would lock the invitation for the person it was sent
 * to. A 256-bit token needs no attempt limit.
 */
export async function consumeInvite(token: string): Promise<string | null> {
  if (!token) return null;

  const row = await prisma.verificationToken.findFirst({
    where: { purpose: "staff_invite", usedAt: null, codeHash: hashCode(token) },
    select: { id: true, userId: true, expiresAt: true },
  });

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await prisma.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}
