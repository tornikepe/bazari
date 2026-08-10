import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/providers/CartProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { getLocale } from "@/lib/locale";
import { headers } from "next/headers";
import { getTheme } from "@/lib/server-theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SITE_URL } from "@/lib/site";
import { getSettings, siteTitle } from "@/lib/settings";
import { getI18n } from "@/lib/locale";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { brandThemeCss } from "@/lib/brand-theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geist ships no Georgian glyphs; this covers them through the font fallback
// chain declared in globals.css.
const notoGeorgian = Noto_Sans_Georgian({
  variable: "--font-noto-georgian",
  subsets: ["georgian"],
  display: "swap",
});

/**
 * Read from the database rather than exported as a constant, because the shop's
 * name is now something its owner sets.
 *
 * Still `title` as a single fixed string with no `template`: the tab must read
 * the same on every route, and no page sets its own. What changed is where the
 * string comes from, not that there is one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [settings, { locale, t }] = await Promise.all([getSettings(), getI18n()]);

  const title = siteTitle(settings, locale);
  const tagline = locale === "ka" ? settings.taglineKa : settings.taglineEn;
  const description = tagline || t.footer.about;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: settings.name,
    openGraph: {
      type: "website",
      siteName: title,
      title,
      description,
      url: SITE_URL,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Only the shell lives here — the storefront chrome is in `(shop)/layout.tsx`
 * and the admin has its own, so the two never inherit each other's frame.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale and theme are both read here so the very first server render is
  // already correct — no flash of the wrong language or a white flash before
  // the dark theme applies.
  const [locale, theme, settings] = await Promise.all([getLocale(), getTheme(), getSettings()]);

  // Set by `proxy.ts`. The CSP forbids inline script without it, so the
  // pre-paint theme script below would simply not run.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // Derived per request rather than cached alongside the settings: it is pure
  // arithmetic on one string, and a stale palette is worse than recomputing it.
  const brandCss = brandThemeCss(settings.brandColor);

  return (
    <html
      lang={locale}
      data-theme={theme}
      // The pre-paint script below may change `data-theme` before React
      // hydrates, which is expected — this stops React flagging it.
      suppressHydrationWarning
      // Opts smooth scrolling out of route transitions, which would otherwise
      // animate the jump to the top of each new page.
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${notoGeorgian.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before paint: falls back to the OS preference for a visitor
            who has never picked a theme. Once they have, the cookie decides
            and this is a no-op. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

        {/* The shop's brand ramp, redefining the same custom properties the
            stylesheet declares. It goes in `head` and not in a client effect
            because a brand colour that arrives after hydration is a visible
            flash of the wrong red on every first paint.

            Empty — and so not rendered at all — while the shop is on the
            default colour, which is every shop that has not changed it. */}
        {brandCss ? (
          <style
            nonce={nonce}
            // The browser blanks a `nonce` attribute once it has applied the
            // CSP, so React reads back "" where the server sent a value and
            // reports a hydration mismatch. Nothing is actually wrong and
            // nothing gets patched up — the warning is the whole cost.
            //
            // The nonce stays even though `style-src` currently allows
            // 'unsafe-inline' and does not need one: the day that directive is
            // tightened, an unnonced palette would silently stop applying.
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: brandCss }}
          />
        ) : null}
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <I18nProvider locale={locale}>
            {/* Read once here and handed down, because the cart is a client
                component and the shipping rules it needs are no longer
                constants it can import. */}
            <SettingsProvider settings={settings}>
              <CartProvider>{children}</CartProvider>
            </SettingsProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
