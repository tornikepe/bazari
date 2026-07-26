/**
 * Theme handling, mirroring the locale approach: the choice lives in a cookie
 * so the server renders the correct theme in the very first HTML — no
 * post-hydration flip from light to dark.
 */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "bz_theme";
export const DEFAULT_THEME: Theme = "light";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * Runs before first paint, so a visitor who has never chosen a theme still
 * gets their OS preference without a flash of the wrong one. Once they pick a
 * theme the cookie wins, and this becomes a no-op.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    if (document.cookie.indexOf('${THEME_COOKIE}=') !== -1) return;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
    }
  } catch (e) {}
})();
`.trim();
