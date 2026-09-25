import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, Noto_Sans_Georgian } from "next/font/google";
import localFont from "next/font/local";
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
 * The Latin half of the shop's voice: Inter, bold and nothing else.
 *
 * The Georgian face is a single bold weight in capital forms, and beside
 * it Geist at 400 read as a whisper next to a shout — a price in Latin
 * digits looked smaller and lighter than the Georgian word in front of
 * it, which is what "the numbers are not centred with the text" was
 * describing. Inter at 700 sits at the same apparent size and the same
 * weight as BPG Nino Mtavruli, so a line that mixes the two reads as one
 * line. One weight only, for the same reason the Georgian has one: the
 * two must not drift apart at a heading.
 *
 * It also carries the three marks the Georgian face does not draw — the
 * lari, the multiplication sign and the minus — and it has proper tabular
 * figures, which the Georgian face does not, so prices still line up in a
 * column.
 */
const inter = Inter({
  variable: "--font-latin",
  subsets: ["latin", "latin-ext"],
  weight: ["700"],
  display: "swap",
});

/**
 * The shop's Georgian face: BPG Nino Mtavruli Bold, self-hosted and with
 * its glyphs moved onto the baseline.
 *
 * The face as published draws everything about four and a half per cent of
 * the em *above* the baseline. On its own that is invisible — every letter
 * floats by the same amount. Beside a Latin face that sits on the baseline
 * properly it is not: "3 პროდუქტი · ჯამი 357,00 ₾" came out with the
 * Georgian riding high and every digit looking dropped, which is what "the
 * numbers are not on the same line as the text" was describing. No CSS can
 * move one font's glyphs relative to another's inside a line — they share
 * the baseline by definition — so the outlines were shifted down by 92
 * units once, here, and the two faces now sit on the same line.
 *
 * `unicode-range` is what makes this a *Georgian* face rather than the
 * site's face. The browser reaches for it only when a character falls in
 * the Georgian blocks, so Latin words, digits, the lari sign, the × in
 * "2 × 179,00 ₾" and the − in "−17%" — none of which this font draws —
 * keep the faces that do. It ships one weight, declared across the whole
 * range so the browser uses it at every weight the page asks for rather
 * than smearing a synthetic bold over an already bold face.
 */
const bpgNino = localFont({
  src: "./fonts/bpg-nino-mtavruli-bold.woff2",
  variable: "--font-georgian",
  weight: "400 900",
  display: "swap",
  /* No metric-matched fallback family. Next would add one — "bpgNino
     Fallback" — with no `unicode-range` of its own, and because it sits
     directly behind this face in the chain it would catch every Latin
     letter and every digit before the Latin face further down was ever
     reached. A face scoped to one script must not be followed by an
     unscoped copy of itself. */
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+10A0-10FF, U+1C90-1CBF, U+2D00-2D2F" }],
});

/**
 * The page may run under the notch and the home indicator.
 *
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` non-zero on a
 * phone with either; without it the insets the stylesheet already asks for
 * are all zero and the browser letterboxes the page instead. Every fixed
 * edge in `globals.css` — the header, the buy bar, the chat launcher, the
 * sheets, the page's own margins — pads by the inset on its side, so nothing
 * sits under the camera in landscape or under the bar at the bottom.
 */
export const viewport: Viewport = {
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

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
      className={`${geistSans.variable} ${geistMono.variable} ${notoGeorgian.variable} ${inter.variable} ${bpgNino.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before paint: falls back to the OS preference for a visitor
            who has never picked a theme. Once they have, the cookie decides
            and this is a no-op. */}
        <script
          nonce={nonce}
          // Same reason as the palette below: the browser blanks `nonce` once
          // the CSP has consumed it, so React reads "" where the server sent a
          // value. Nothing is patched; only the warning is silenced.
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />

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
