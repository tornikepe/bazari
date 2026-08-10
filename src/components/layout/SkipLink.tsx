"use client";

import { useI18n } from "@/components/providers/I18nProvider";

/**
 * The first thing in the tab order: a way past the header.
 *
 * Without it, reaching the page content by keyboard means tabbing through the
 * logo, the search field, its button, five icon buttons and the language
 * toggle — on every page, every time. That is the single most common complaint
 * about keyboard navigation on a shop, and the fix is one link.
 *
 * Hidden until focused, and only until focused. `sr-only` alone would leave it
 * invisible to a sighted keyboard user, who then tabs onto a control they
 * cannot see and cannot guess at; `focus:not-sr-only` brings it back into the
 * page the moment it matters.
 */
export function SkipLink() {
  const { t } = useI18n();

  return (
    <a
      href="#main"
      className="sr-only z-100 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:flex focus:min-h-11 focus:items-center focus:border focus:border-line focus:bg-surface focus:px-4 focus:text-sm focus:font-semibold focus:text-ink-900 focus:shadow-pop"
    >
      {t.nav.skipToContent}
    </a>
  );
}
