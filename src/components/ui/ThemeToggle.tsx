"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { MoonIcon, SunIcon } from "@/components/ui/icons";

/**
 * Which icon shows is decided entirely in CSS from `[data-theme]` on the root
 * (see `.theme-icon-*` in globals.css) — not from React state. That keeps the
 * button correct even though the pre-paint script may change the theme after
 * the server rendered the markup.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { toggle } = useTheme();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t.theme.toggle}
      title={t.theme.toggle}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-control ${className}`}
    >
      {/* Both icons stay mounted and cross-fade, so the button never changes
          size and nothing beside it shifts. */}
      <SunIcon size={18} className="theme-icon-sun col-start-1 row-start-1" />
      <MoonIcon size={18} className="theme-icon-moon col-start-1 row-start-1" />
    </button>
  );
}
