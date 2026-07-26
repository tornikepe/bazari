import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/providers/CartProvider";
import { I18nProvider } from "@/components/providers/I18nProvider";
import { getLocale } from "@/lib/locale";
import { SITE_NAME, SITE_URL } from "@/lib/site";

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
  title: {
    default: `${SITE_NAME} — ონლაინ მაღაზია`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ონლაინ მაღაზია`,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ონლაინ მაღაზია`,
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
  // Read the locale once here so the first server render is already in the
  // right language — no flash of the default locale.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      // Opts smooth scrolling out of route transitions, which would otherwise
      // animate the jump to the top of each new page.
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${notoGeorgian.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale}>
          <CartProvider>{children}</CartProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
