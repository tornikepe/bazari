import Link from "next/link";
import { FooterLink } from "@/components/layout/FooterLink";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { MailIcon, PhoneIcon } from "@/components/ui/icons";
import { getSettings } from "@/lib/settings";
import { getPublishedPages } from "@/lib/info-store";
import { getI18n } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { InstallPrompt } from "@/components/layout/InstallPrompt";

/**
 * The foot of every shop page.
 *
 * It was 420px tall on a desktop and a full screen and a half on a phone:
 * five columns of 44px rows, each a category or a page, under a paragraph
 * about the shop. Now it is the mark, the paragraph and the contact line on
 * the left, and the three lists in three tight columns on the right —
 * 32px rows, and on a phone the categories as a wrapped row rather than a
 * column of six. About half the height, with nothing left out.
 */
export async function Footer() {
  const [{ locale, t }, settings] = await Promise.all([getI18n(), getSettings()]);
  const published = await getPublishedPages(locale);

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }],
    take: 6,
    select: { slug: true, nameKa: true, nameEn: true },
  });

  // Built from the pages that actually exist and are published, using each
  // page's own title. A shop that unpublishes its warranty page should stop
  // linking to it — a footer link to a blank page is worse than no link, and
  // the label should be whatever the owner called it rather than a fixed
  // string in the dictionary.
  const byGroup = (slugs: readonly string[]) =>
    slugs.flatMap((slug) => {
      const page = published.find((candidate) => candidate.slug === slug);
      return page ? [{ href: `/${slug}`, label: page.title }] : [];
    });

  const groups = [
    {
      id: "footer-shop",
      title: t.footer.shop,
      links: categories.map((category) => ({
        href: `/catalog?category=${category.slug}`,
        label: locale === "ka" ? category.nameKa : category.nameEn,
      })),
      // The one list long enough to be a column on a phone; it wraps instead.
      wrap: true,
    },
    {
      id: "footer-company",
      title: t.footer.company,
      links: [...byGroup(["about", "contact"]), ...byGroup(["terms", "privacy"])],
      wrap: false,
    },
    {
      id: "footer-help",
      title: t.footer.help,
      links: [
        { href: "/track", label: t.orderDone.trackHint },
        ...byGroup(["faq", "shipping", "returns", "warranty"]),
      ],
      wrap: false,
    },
  ];

  return (
    // No top margin. A margin cannot be painted, so `mt-16` left a 4rem band
    // of the page background between two `bg-surface` blocks — on the home
    // page that read as a black stripe above the footer in dark mode. The
    // separation is now the footer's own top rule plus its internal padding,
    // which is surface-coloured and therefore invisible as a seam.
    <footer className="site-footer border-t border-line bg-surface">
      <div className="page-container grid gap-8 py-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12 lg:py-10">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5">
            <LogoMark size={32} />
            <Wordmark name={settings.name} className="text-base" />
          </Link>

          <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-500 sm:text-sm">
            {t.footer.about}
          </p>

          {/* The ways to reach the shop, when it has set any: one line each,
              and the line is the link. */}
          {(settings.contactPhone || settings.contactEmail) && (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {settings.contactPhone && (
                <li>
                  <a
                    href={`tel:${settings.contactPhone.replace(/\s+/g, "")}`}
                    className="inline-flex min-h-8 items-center gap-1.5 text-ink-700 transition-colors hover:text-brand-600"
                  >
                    <PhoneIcon size={14} className="text-ink-400" />
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings.contactEmail && (
                <li>
                  <a
                    href={`mailto:${settings.contactEmail}`}
                    className="inline-flex min-h-8 items-center gap-1.5 text-ink-700 transition-colors hover:text-brand-600"
                  >
                    <MailIcon size={14} className="text-ink-400" />
                    {settings.contactEmail}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Three columns from `sm` up. On a phone the two short lists share
            a row and the categories, wrapped, take the row above them. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
          {groups.map((group) => (
            <nav
              key={group.id}
              aria-labelledby={group.id}
              className={group.wrap ? "col-span-2 sm:col-span-1" : ""}
            >
              <h2 id={group.id} className="label mb-2 text-ink-900">
                {group.title}
              </h2>
              <ul
                className={
                  group.wrap
                    ? "flex flex-wrap gap-x-4 sm:flex-col sm:gap-x-0"
                    : "flex flex-col"
                }
              >
                {group.links.map((link) => (
                  <li key={link.href}>
                    <FooterLink href={link.href}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-line">
        <div className="page-container flex flex-col items-center justify-between gap-1.5 py-3 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} {settings.name}. {t.footer.rights}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end">
            <InstallPrompt />
            <p className="text-xs text-ink-400">{t.footer.demoNote}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
