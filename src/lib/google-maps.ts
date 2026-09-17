/**
 * Google Maps in the browser, loaded once and only when asked for.
 *
 * The key is `NEXT_PUBLIC_GOOGLE_MAPS_KEY`; without it there is no map,
 * and the parts of the site that would offer one offer nothing. The
 * script is added by a nonced script of ours, which is what the page's
 * `strict-dynamic` policy allows; the modules it loads after that are
 * trusted the same way.
 */

declare global {
  interface Window {
    google?: typeof google;
    __bazariMaps?: Promise<typeof google>;
  }
}

export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export function mapsAvailable(): boolean {
  return MAPS_KEY.length > 0;
}

export function loadGoogleMaps(language: "ka" | "en"): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__bazariMaps) return window.__bazariMaps;

  window.__bazariMaps = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: MAPS_KEY,
      v: "weekly",
      language,
      region: "GE",
      libraries: "marker",
      loading: "async",
      callback: "__bazariMapsReady",
    });
    (window as unknown as Record<string, unknown>).__bazariMapsReady = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("maps did not load"));
    };
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("maps script failed"));
    document.head.appendChild(script);
  });
  return window.__bazariMaps;
}
