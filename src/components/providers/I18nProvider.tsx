"use client";

import { createContext, use, useCallback, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  getDictionary,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

type I18nValue = {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  isSwitching: boolean;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * The locale lives in a cookie so Server Components render the right language
 * on the first paint. Switching writes the cookie and refreshes the router,
 * which re-renders both server and client trees — no hydration mismatch.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isSwitching, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      startTransition(() => router.refresh());
    },
    [router],
  );

  const value = useMemo<I18nValue>(
    () => ({ locale, t: getDictionary(locale), setLocale, isSwitching }),
    [locale, setLocale, isSwitching],
  );

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const value = use(I18nContext);
  if (!value) {
    // Keeps isolated component previews from crashing.
    return {
      locale: DEFAULT_LOCALE,
      t: getDictionary(DEFAULT_LOCALE),
      setLocale: () => {},
      isSwitching: false,
    } satisfies I18nValue;
  }
  return value;
}
