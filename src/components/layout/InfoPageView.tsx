import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { getSettings } from "@/lib/settings";
import { getPage } from "@/lib/info-store";
import type { InfoSlug } from "@/lib/info-pages";
import { MailIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons";

/** Shared renderer for every footer information page. */
export async function InfoPageView({ slug }: { slug: InfoSlug }) {
  const [{ locale, t }, settings] = await Promise.all([getI18n(), getSettings()]);
  const page = await getPage(slug, locale);

  /**
   * The shop's real contact details, on the contact page only.
   *
   * Every row is omitted when its field is empty rather than rendered with a
   * dash. A shop that has not got a phone number yet should say nothing about
   * phone numbers — this is the same rule the rest of the site follows about
   * never showing a figure it cannot stand behind.
   */
  const contact =
    slug === "contact"
      ? [
          { icon: MailIcon, value: settings.contactEmail, href: `mailto:${settings.contactEmail}` },
          { icon: PhoneIcon, value: settings.contactPhone, href: `tel:${settings.contactPhone}` },
          { icon: MapPinIcon, value: settings.contactAddress, href: null },
          {
            icon: null,
            value: locale === "ka" ? settings.contactHoursKa : settings.contactHoursEn,
            href: null,
          },
        ].filter((row) => row.value.trim().length > 0)
      : [];

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

        {contact.length > 0 && (
          <section className="card mt-6 p-5">
            <h2 className="text-sm font-bold text-ink-900">{t.footer.contactUs}</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {contact.map((row) => (
                <li key={row.value} className="flex items-center gap-2.5 text-sm text-ink-700">
                  {row.icon ? (
                    <row.icon size={16} className="shrink-0 text-ink-400" />
                  ) : (
                    <span className="w-4 shrink-0" aria-hidden="true" />
                  )}
                  {row.href ? (
                    <a href={row.href} className="transition-colors hover:text-brand-600">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

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
 * Deliberately sets only the description: the tab title is one string for the
 * whole site, built from the shop's name in the root layout, and no page
 * overrides it.
 */
export async function infoMetadata(slug: InfoSlug) {
  const { locale } = await getI18n();
  const page = await getPage(slug, locale);
  return { description: page.intro.slice(0, 160) };
}
