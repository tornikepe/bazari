import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { NoResultsArt } from "@/components/ui/illustrations";
import { ChevronRightIcon } from "@/components/ui/icons";

/**
 * The 404, without its chrome.
 *
 * Rendered twice over: by the root `not-found.tsx`, which sits outside the
 * `(shop)` group and wraps this in a header and footer of its own, and by
 * the shop's `not-found.tsx`, which sits inside the group and already has
 * both — a product that does not exist was showing two headers and two
 * footers, the layout's and the page's.
 */
export async function NotFoundView() {
  const { locale, t } = await getI18n();

  /* Six at most: this is a signpost, not the catalogue. Ordered the way the
     shop orders them everywhere else rather than by name, so the list reads
     the same here as it does in the menu. */
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    take: 6,
    select: { slug: true, nameKa: true, nameEn: true, icon: true },
  });

  return (
    <div className="page-notice">
      <div className="mx-auto max-w-lg">
        {/* The drawing rather than a giant numeral. "404" is a status code
            — it means something to whoever wrote the link and nothing to
            the person who followed it, so it stays as the small print and
            the picture and the sentence carry the page. */}
        <div className="flex flex-col items-center text-center">
          <NoResultsArt size={104} />

          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink-900">
            {t.common.notFoundTitle}
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-500">
            {t.common.notFoundText}
          </p>
          <p className="mt-2 font-mono text-xs text-ink-400">404</p>
        </div>

        {/* A dead end is a bad empty state — most people arriving here
            were looking for a product, so the search comes before the
            links out. */}
        <form action="/catalog" className="mt-7 flex gap-2">
          <input
            type="search"
            name="q"
            aria-label={t.nav.search}
            placeholder={t.nav.searchPlaceholder}
            className="field min-h-11 min-w-0 flex-1"
          />
          <button type="submit" className="btn btn-primary btn-md shrink-0">
            {t.nav.search}
          </button>
        </form>

        {/* And the shelves themselves, because "go to the homepage" is a
            way out rather than a way on. Counted from the database — the
            categories a visitor can actually browse right now. */}
        {categories.length > 0 && (
          <nav aria-labelledby="notfound-categories" className="mt-8">
            <h2
              id="notfound-categories"
              className="text-xs font-bold tracking-wider text-ink-400 uppercase"
            >
              {t.nav.categories}
            </h2>

            <ul className="mt-3 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/catalog?category=${category.slug}`}
                    className="flex min-h-12 items-center justify-between gap-3 bg-surface px-4 text-sm text-ink-800 transition-colors hover:bg-ink-50"
                  >
                    <span className="truncate">
                      {category.icon}{" "}
                      {locale === "ka" ? category.nameKa : category.nameEn}
                    </span>
                    <ChevronRightIcon
                      size={15}
                      className="shrink-0 text-ink-300"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-outline btn-md">
            {t.common.goHome}
          </Link>
          <Link href="/catalog" className="btn btn-outline btn-md">
            {t.catalog.title}
          </Link>
        </div>
      </div>
    </div>
  );
}
