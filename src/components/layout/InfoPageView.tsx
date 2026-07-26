import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { getInfoPage, type InfoSlug } from "@/lib/info-pages";

/** Shared renderer for every footer information page. */
export async function InfoPageView({ slug }: { slug: InfoSlug }) {
  const { locale, t } = await getI18n();
  const page = getInfoPage(slug, locale);

  return (
    <div className="page-container py-8 lg:py-12">
      <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs text-ink-400">
        <Link href="/" className="transition-colors hover:text-brand-600">
          {t.nav.home}
        </Link>
        <span>/</span>
        <span className="text-ink-600">{page.title}</span>
      </nav>

      <article className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
          {page.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">{page.intro}</p>

        <div className="mt-6 flex flex-col gap-4">
          {page.sections.map((section) => (
            <section key={section.heading} className="card p-5">
              <h2 className="text-sm font-bold text-ink-900">{section.heading}</h2>
              <div className="mt-2 flex flex-col gap-2">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-ink-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/catalog" className="btn btn-primary btn-md">
            {t.catalog.title}
          </Link>
          <Link href="/contact" className="btn btn-outline btn-md">
            {t.footer.contactUs}
          </Link>
        </div>
      </article>
    </div>
  );
}

/**
 * Metadata for an information route.
 *
 * Deliberately sets only the description: the tab title is a single fixed
 * string for the whole site (see `SITE_TITLE`), so no page overrides it.
 */
export async function infoMetadata(slug: InfoSlug) {
  const { locale } = await getI18n();
  const page = getInfoPage(slug, locale);
  return { description: page.intro.slice(0, 160) };
}
