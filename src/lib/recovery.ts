import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth-hash";

/**
 * Eight one-time ways back into a staff account.
 *
 * Every other way back goes through a mailbox, and this shop's staff address
 * is on a domain it does not receive mail at: "email me a reset link" sends
 * the link nowhere, and a second factor delivered by mail would lock the
 * owner out rather than protect them. These are the answer to that — the
 * thing a bank gives you on paper, and the thing GitHub and Google call
 * backup codes.
 *
 * They are also what makes a long random password safe to use. A password
 * nobody can memorise is only a good password if losing it is survivable.
 *
 * Shown once. What is stored is the scrypt hash, so the shop cannot read
 * them back any more than an attacker reading the database could.
 */

/** How many are made at a time. Eight is enough to lose a few and still get in. */
export const RECOVERY_CODE_COUNT = 8;

/** Read off a screen and typed back, so no 0/O and no 1/l/I. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 10;

/** Unbiased: the leftover of a byte over the alphabet is drawn again. */
function makeCode(): string {
  const ceiling = 256 - (256 % ALPHABET.length);
  const chars: string[] = [];
  while (chars.length < LENGTH) {
    for (const byte of randomBytes(32)) {
      if (byte >= ceiling) continue;
      chars.push(ALPHABET[byte % ALPHABET.length]!);
      if (chars.length === LENGTH) break;
    }
  }
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

/** Whatever was typed, as the code was given out: lower case, one dash. */
export function tidyCode(typed: string): string {
  const letters = typed.toLowerCase().replace(/[^a-z0-9]/g, "");
  return letters.length === LENGTH ? `${letters.slice(0, 5)}-${letters.slice(5)}` : letters;
}

/**
 * A fresh set, replacing whatever the account had.
 *
 * The old ones go in the same transaction that writes the new ones: a set
 * half-replaced is a set nobody can count, and the panel's "five left" has
 * to mean something.
 */
export async function issueRecoveryCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, makeCode);

  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashPassword(code) })),
    }),
  ]);

  return codes;
}

/** How many of this account's codes are still unspent. */
export function countRecoveryCodes(userId: string): Promise<number> {
  return prisma.recoveryCode.count({ where: { userId, usedAt: null } });
}

/**
 * Spends a code, if it is one of this account's unspent ones.
 *
 * Every unspent hash is tried, because a hash cannot be looked up by the
 * thing it hashes. Eight scrypt comparisons is a few hundred milliseconds,
 * which is fine for a path taken once a year and is the caller's reason to
 * meter it: see the action, which counts attempts per address and per
 * address-and-IP before it ever gets here.
 *
 * The spending is conditional — `usedAt: null` in the `updateMany` — so two
 * requests racing with the same code cannot both be let in.
 */
export async function spendRecoveryCode(userId: string, typed: string): Promise<boolean> {
  const code = tidyCode(typed);
  if (code.length !== LENGTH + 1) return false;

  const held = await prisma.recoveryCode.findMany({
    where: { userId, usedAt: null },
    select: { id: true, codeHash: true },
  });

  for (const row of held) {
    if (!verifyPassword(code, row.codeHash)) continue;

    const spent = await prisma.recoveryCode.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return spent.count === 1;
  }

  return false;
}
