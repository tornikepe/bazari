import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { deriveBrandTheme, DEFAULT_BRAND_COLOR } from "@/lib/brand-theme";

/**
 * What a browser needs to install the shop as an application.
 *
 * The name and the colours come from the settings row rather than from
 * constants here, for the same reason every other user-facing string does: a
 * shop that renames itself on the settings page and then installs to a home
 * screen called "Bazari" has been told one thing and shown another.
 *
 * One language, and it is the shop's own name — a manifest has no locale
 * negotiation, so there is nothing to negotiate. The description is the
 * English tagline because it has to be *a* language and the name is the part
 * that appears under the icon.
 *
 * `display: "standalone"` rather than `fullscreen`: this is a shop, and a
 * shopper who cannot see the clock or the battery while deciding whether to
 * spend money is being held somewhere, not served.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings();

  return {
    name: settings.name,
    short_name: settings.name,
    description: settings.taglineEn || `${settings.name} — ${settings.titleSuffixEn}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The canvas, so the splash screen is the page's own background rather
    // than a white flash before it.
    background_color: "#f4f5f7",
    // The shop's colour, derived the same way the stylesheet derives it — a
    // browser paints its title bar with this, and it sitting a shade off the
    // header would be visible on every launch.
    theme_color:
      deriveBrandTheme(settings.brandColor)?.light["brand-solid"] ?? DEFAULT_BRAND_COLOR,
    icons: [
      // The scalable one first: a browser that can use it should, and the
      // bitmaps below exist for the ones that cannot.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      /* The same square again, declared maskable.
       *
       * It can be: Android crops an installed icon to whatever shape the
       * launcher uses, and the safe area is the middle 80%. The four squares
       * sit between 18.75% and 81.25% of the artwork, so the crop takes only
       * the dark ground they are set on — which is what it is there for. */
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
