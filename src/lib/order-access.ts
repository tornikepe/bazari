import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Who is allowed to see a guest order's full details.
 *
 * The confirmation page is reachable by URL alone, so without this anyone who
 * guesses an order number could read the buyer's name, phone and address.
 * A shopper who just checked out has no account to prove ownership with, so
 * `placeOrder` drops a signed, httpOnly cookie naming the orders placed from
 * this browser; the page trusts that, the order's owner, or an admin.
 *
 * Anyone else is sent to `/track`, which asks for the phone number.
 */
const RECEIPT_COOKIE = "bz_receipts";
const RECEIPT_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Keeps the cookie small — older receipts fall off the end. */
const MAX_REMEMBERED = 20;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET is not set — copy .env.example to .env");
  }
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function verify(payload: string, signature: string) {
  const expected = Buffer.from(sign(payload), "hex");
  const provided = Buffer.from(signature, "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

/** Order numbers this browser is allowed to view, per the signed cookie. */
export async function readReceipts(): Promise<string[]> {
  const raw = (await cookies()).get(RECEIPT_COOKIE)?.value;
  if (!raw) return [];

  const separator = raw.lastIndexOf(".");
  if (separator === -1) return [];

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!verify(payload, signature)) return [];

  return payload.split(",").filter(Boolean);
}

/** Remembers one more order number for this browser. */
export async function rememberReceipt(orderNumber: string) {
  const existing = await readReceipts();
  const next = [orderNumber, ...existing.filter((n) => n !== orderNumber)].slice(0, MAX_REMEMBERED);

  const payload = next.join(",");
  (await cookies()).set(RECEIPT_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: RECEIPT_MAX_AGE,
  });
}
