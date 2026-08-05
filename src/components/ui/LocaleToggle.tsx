"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { LOCALES, type Locale } from "@/lib/i18n";

const SHORT: Record<Locale, string> = { ka: "ქარ", en: "EN" };

/**
 * The language switch, as a two-segment control.
 *
 * Every dimension here is fixed rather than derived from the text. "ქარ" and
 * "EN" are different lengths in different scripts, so a control sized by its
 * content would resize the instant you used it — and because it sits in the
 * header, everything to the left of it would slide. The segments are `w-11`
 * and the track is `h-10`, matching the icon buttons beside it, so the header
 * measures the same in both languages and the pressed state only repaints
 * colour.
 *
 * `tone="panel"` is the variant for dark panel backgrounds (the admin rail);
 * the default reads on the light surface of the storefront header.
 */
export function LocaleToggle({
  tone = "surface",
  className = "",
}: {
  tone?: "surface" | "panel";
  className?: string;
}) {
  const { locale, setLocale, t } = useI18n();

  const track =
    tone === "panel" ? "border-panel-fg/20 bg-panel/40" : "border-line bg-surface";

  const segment = (active: boolean) =>
    active
      ? tone === "panel"
        ? "bg-panel-fg text-panel"
        : "bg-ink-900 text-surface"
      : tone === "panel"
        ? "text-panel-muted hover:text-panel-fg"
        : "text-ink-500 hover:text-ink-900";

  return (
    <div
      role="group"
      aria-label={t.nav.language}
      className={`flex h-10 shrink-0 items-center border ${track} ${className}`}
    >
      {LOCALES.map((code: Locale) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          // `lang` so a screen reader announces each label in its own
          // language rather than reading "ქარ" with an English voice.
          lang={code}
          // `h-full`, not a fixed height inside a taller track. At h-8 in an
          // h-10 frame the pressed segment left a strip of the track showing
          // above and below it, which read as a dark seam around the label
          // rather than as a selected tab.
          className={`h-full w-11 text-xs font-bold transition-colors duration-200 not-first:border-l not-first:border-line ${segment(
            locale === code,
          )}`}
        >
          {SHORT[code]}
        </button>
      ))}
    </div>
  );
}
