import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/providers/CartProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { getLocale } from "@/lib/locale";
import { getTheme } from "@/lib/server-theme";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { SITE_TITLE, SITE_URL } from "@/lib/site";

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

const DESCRIPTION =
  "Bazari — ტექნიკა, აქსესუარები და საყოფაცხოვრებო ნივთები. გაფილტრე კატეგორიით, ფასით ან ბრენდით და შეუკვეთე ონლაინ.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Deliberately a single fixed string with no `template`: the tab title
  // must read the same on every route, so pages never override it.
  title: SITE_TITLE,
  description: DESCRIPTION,
  applicationName: SITE_TITLE,
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: DESCRIPTION,
  },
};

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
  const [locale, theme] = await Promise.all([getLocale(), getTheme()]);

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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <I18nProvider locale={locale}>
            <CartProvider>{children}</CartProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
