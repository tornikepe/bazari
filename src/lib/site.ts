/**
 * Canonical site URL, used by metadata, the sitemap and robots.txt.
 * Set `NEXT_PUBLIC_SITE_URL` in production so absolute URLs (Open Graph
 * images, sitemap entries) point at the real domain instead of localhost.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

/* The shop's name is not here any more.
 *
 * It was two constants, and a shop renamed on the settings page kept the old
 * name in its footer sentence, its share cards, its structured data, the
 * dashboard rail and the signature on every email it sent. The name now
 * comes from the settings row in all of those places — `settings.name`, or
 * `brandName(locale)` in `settings.ts` where the suffix belongs with it.
 *
 * Only the URL stays a constant, because it is a deployment fact rather than
 * something the shop's owner types. */
