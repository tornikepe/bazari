"use client";

import { createContext, use, useCallback, useMemo } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

type ThemeValue = {
  toggle: () => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Deliberately stateless.
 *
 * The theme lives in one place — the `data-theme` attribute on `<html>` — and
 * every colour is a CSS variable keyed off it. Mirroring it into React state
 * would mean the state and the DOM could disagree: the pre-paint script can
 * set the attribute to `dark` before hydration, while the server rendered
 * `light`, and the toggle would then need two clicks to catch up.
 *
 * Reading the attribute at click time keeps the two impossible to desync, and
 * the switch is instant because no re-render is involved.
 */
export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next: Theme = root.dataset.theme === "dark" ? "light" : "dark";

    root.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<ThemeValue>(() => ({ toggle }), [toggle]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  // Falls back to a no-op so isolated previews don't crash.
  return use(ThemeContext) ?? { toggle: () => {} };
}
