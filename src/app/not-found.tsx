import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

/**
 * Root 404. It renders its own chrome because `not-found.tsx` at the app root
 * sits outside the `(shop)` group and so doesn't inherit that layout.
 */
export default async function NotFound() {
  const { t } = await getI18n();

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="page-container py-20">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <p className="text-6xl font-black tracking-tight text-brand-600">404</p>
            <h1 className="mt-3 text-xl font-bold text-ink-900">{t.common.notFoundTitle}</h1>
            <p className="mt-2 text-sm text-ink-500">{t.common.notFoundText}</p>

            {/* A dead end is a bad empty state — most people arriving here
                were looking for a product, so let them search from here. */}
            <form action="/catalog" className="mt-6 flex w-full max-w-sm gap-2">
              <input
                type="search"
                name="q"
                aria-label={t.nav.search}
                placeholder={t.nav.searchPlaceholder}
                className="field min-w-0 flex-1"
              />
              <button type="submit" className="btn btn-primary btn-md shrink-0">
                {t.nav.search}
              </button>
            </form>

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href="/" className="btn btn-primary btn-md">
                {t.common.goHome}
              </Link>
              <Link href="/catalog" className="btn btn-outline btn-md">
                {t.catalog.title}
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
