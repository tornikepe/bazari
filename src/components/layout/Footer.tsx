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
 * On a phone everything is centred and short: the mark, one sentence, the
 * ways to reach the shop, and each list of links as a row of small pills
 * that wraps — a column of links a thumb-width tall was a screen and a
 * half. From `sm` up the lists are three columns of plain rows beside the
 * mark, as a footer is expected to read on a wide screen.
 *
 * The sentence is the shop's own tagline from the settings page when it
 * has set one, and the dictionary's line until then.
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
    },
    {
      id: "footer-company",
      title: t.footer.company,
      links: [...byGroup(["about", "contact"]), ...byGroup(["terms", "privacy"])],
    },
    {
      id: "footer-help",
      title: t.footer.help,
      links: [
        { href: "/track", label: t.orderDone.trackHint },
        ...byGroup(["faq", "shipping", "returns", "warranty"]),
      ],
    },
  ];

  const tagline = (locale === "ka" ? settings.taglineKa : settings.taglineEn) || t.footer.about;
  const contacts = [
    settings.contactPhone && {
      href: `tel:${settings.contactPhone.replace(/\s+/g, "")}`,
      label: settings.contactPhone,
      icon: PhoneIcon,
    },
    settings.contactEmail && {
      href: `mailto:${settings.contactEmail}`,
      label: settings.contactEmail,
      icon: MailIcon,
    },
  ].filter((contact): contact is Exclude<typeof contact, "" | false> => Boolean(contact));

  return (
    // No top margin. A margin cannot be painted, so `mt-16` left a 4rem band
    // of the page background between two `bg-surface` blocks — on the home
    // page that read as a black stripe above the footer in dark mode. The
    // separation is now the footer's own top rule plus its internal padding,
    // which is surface-coloured and therefore invisible as a seam.
    <footer className="site-footer border-t border-line bg-surface">
      <div className="page-container grid gap-6 py-8 text-center sm:gap-8 sm:py-10 sm:text-left lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div className="flex flex-col items-center sm:items-start">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <LogoMark size={32} />
            <Wordmark name={settings.name} className="text-base" />
          </Link>

          <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-500 sm:text-sm">{tagline}</p>

          {/* The ways to reach the shop, when it has set any: one line each,
              and the line is the link. */}
          {contacts.length > 0 && (
            <ul className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-sm sm:justify-start">
              {contacts.map((contact) => (
                <li key={contact.href}>
                  <a
                    href={contact.href}
                    className="inline-flex min-h-8 items-center gap-1.5 text-ink-700 transition-colors hover:text-brand-600"
                  >
                    <contact.icon size={14} className="text-ink-400" />
                    {contact.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Three columns from `sm` up. On a phone each list is a heading
            and a wrapped row of pills, centred — see `.footer-pill`. */}
        <div className="grid gap-5 sm:grid-cols-3 sm:gap-x-6">
          {groups.map((group) => (
            <nav key={group.id} aria-labelledby={group.id}>
              <h2 id={group.id} className="label mb-2 text-ink-900">
                {group.title}
              </h2>
              <ul className="flex flex-wrap justify-center gap-1.5 sm:flex-col sm:gap-0">
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

      {/* The name, set large in the serif, with the copyright beside it —
          the last thing on every page, as a signature. Extra room at the
          foot on a phone: the chat launcher is fixed to the bottom-right
          corner, and with the page scrolled to its end it sat on the last
          word of the copyright line. */}
      <div className="border-t border-line">
        <div className="page-container flex flex-col items-center gap-3 pt-6 pb-[4.25rem] text-center sm:flex-row sm:items-end sm:justify-between sm:pb-6 sm:text-left">
          <p className="footer-wordmark -mb-[0.1em]" aria-hidden="true">
            {settings.name}
          </p>
          <div className="flex flex-col items-center gap-1.5 sm:items-end">
            <InstallPrompt />
            <p className="text-xs text-ink-400">
              © {new Date().getFullYear()} {settings.name}. {t.footer.rights}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
