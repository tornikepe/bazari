/**
 * Canonical site URL, used by metadata, the sitemap and robots.txt.
 * Set `NEXT_PUBLIC_SITE_URL` in production so absolute URLs (Open Graph
 * images, sitemap entries) point at the real domain instead of localhost.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Bazari";
