import "server-only";

/**
 * The one secret everything else is keyed on.
 *
 * Session cookies, the receipt cookie, the sealed gateway credentials, the
 * sandbox's signatures and the daily visitor hash all derive their key from
 * `AUTH_SECRET`. Four of those read it carefully and two used to read it as
 * `process.env.AUTH_SECRET ?? ""` — which does not fail, it quietly keys
 * everything on the empty string, and an HMAC keyed on a value everybody
 * knows is a signature anybody can write. A missing secret has to stop the
 * request, not weaken it.
 */
export function authSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET is not set — copy .env.example to .env");
  }
  return value;
}
