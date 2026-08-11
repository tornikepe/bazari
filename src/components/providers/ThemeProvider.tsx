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
 * would mean the state and the DOM could disagree: the pre-paint script can set
 * the attribute to `dark` before hydration, while the server rendered `light`,
 * and the toggle would then need two clicks to catch up.
 *
 * Reading the attribute at click time keeps the two impossible to desync.
 */
export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next: Theme = root.dataset.theme === "dark" ? "light" : "dark";

    const change = () => {
      root.dataset.theme = next;
      document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    };

    /**
     * Cross-fade the two themes rather than cutting between them.
     *
     * ## Why not a CSS transition
     *
     * The obvious approach — switch on `transition: background-color …` for the
     * length of the change — does nothing at all here, and it took listening
     * for `transitionrun` to see that rather than watching it and believing it
     * looked smooth. Every colour on this site is `var(--color-…)`, and an
     * unregistered custom property is not animatable: when `data-theme` flips,
     * the dependent `background-color` recomputes without ever starting a
     * transition. The stylesheet reported a correct `0.7s` on every element and
     * not one transition ran.
     *
     * Registering forty tokens with `@property` would make them animatable, and
     * would also make every unrelated colour change animate. A view transition
     * is the mechanism meant for this: it snapshots the page before and after
     * and blends the two, so it does not care how many variables moved or
     * whether they were animatable.
     *
     * ## When it is not available
     *
     * Safari only gained it in 18, so the theme still has to change without it.
     * The fallback is the instant switch this had before — a missing fade is a
     * missing nicety, a theme that will not change is a broken control.
     */
    const wantsMotion = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!wantsMotion || typeof document.startViewTransition !== "function") {
      change();
      return;
    }

    document.startViewTransition(change);
  }, []);

  const value = useMemo<ThemeValue>(() => ({ toggle }), [toggle]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  // Falls back to a no-op so isolated previews don't crash.
  return use(ThemeContext) ?? { toggle: () => {} };
}
