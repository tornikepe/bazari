import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Seals a secret so it can sit in the database without being readable there.
 *
 * AES-256-GCM under a key derived from `AUTH_SECRET`, one random nonce per
 * value. A gateway's client secret is written through this and read back
 * through it, so a dump of the `PaymentGateway` table is not a dump of the
 * shop's bank credentials. Rotating `AUTH_SECRET` makes every sealed value
 * unreadable, which is the right cost: the dashboard asks for them again.
 *
 * The output is marked, so a value that was never sealed — an id, a
 * currency code — passes through `open` untouched.
 */

const MARK = "sealed:v1:";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret)
    throw new Error("AUTH_SECRET is not set — copy .env.example to .env");
  return createHash("sha256").update(`${secret}:secret-box`).digest();
}

export function seal(plain: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return MARK + Buffer.concat([nonce, tag, body]).toString("base64url");
}

export function isSealed(value: string): boolean {
  return value.startsWith(MARK);
}

/** The plain text, or `""` for a value sealed under a key this is not. */
export function open(value: string): string {
  if (!isSealed(value)) return value;
  try {
    const raw = Buffer.from(value.slice(MARK.length), "base64url");
    const nonce = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const body = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return "";
  }
}
