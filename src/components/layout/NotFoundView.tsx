import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { NoResultsArt } from "@/components/ui/illustrations";

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
     the same here as it does in the menu, and only the ones the shop is
     listing — a shelf hidden from the bar should not be offered here. */
  const categories = await prisma.category.findMany({
    where: { isVisible: true },
    orderBy: { sortOrder: "asc" },
    take: 6,
    select: { slug: true, nameKa: true, nameEn: true, icon: true },
  });

  return (
    <div className="page-notice">
      {/* Everything on this page is centred on its own axis, including the
          blocks that are not themselves text: the search row and the list of
          shelves used to be full-width inside the column while the words
          above them were centred, which read as two pages stacked. */}
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        {/* The drawing rather than a giant numeral. "404" is a status code
            — it means something to whoever wrote the link and nothing to
            the person who followed it, so it stays as the small print and
            the picture and the sentence carry the page. */}
        <div className="flex flex-col items-center">
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
        <form action="/catalog" className="mt-7 flex w-full max-w-md gap-2">
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
            way out rather than a way on. Only the ones a visitor can
            actually browse right now.

            Laid out as a centred row that wraps, not as a grid. A grid of
            two columns has to be given an even number of things or it ends
            with a hole where the last cell should be, and it is only ever
            centred by accident — with two categories it was a wide pair of
            boxes, with five, four boxes and a gap. Wrapped pills centre
            themselves at any count, including one. */}
        {categories.length > 0 && (
          <nav aria-labelledby="notfound-categories" className="mt-8 text-center">
            <h2
              id="notfound-categories"
              className="text-xs font-bold tracking-wider text-ink-400 uppercase"
            >
              {t.nav.categories}
            </h2>

            <ul className="mt-3 flex flex-wrap justify-center gap-2">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/catalog?category=${category.slug}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm leading-snug text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <span aria-hidden="true">{category.icon}</span>
                    {locale === "ka" ? category.nameKa : category.nameEn}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
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
