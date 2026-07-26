/**
 * Canonical site URL, used by metadata, the sitemap and robots.txt.
 * Set `NEXT_PUBLIC_SITE_URL` in production so absolute URLs (Open Graph
 * images, sitemap entries) point at the real domain instead of localhost.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "Bazari";

/**
 * The browser tab title, used verbatim on every route.
 *
 * There is no `template` in the root metadata and no page sets its own title,
 * so this string is what shows everywhere — by design.
 */
export const SITE_TITLE = "Bazari - ონლაინ მაღაზია";
