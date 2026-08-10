import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { getSettings } from "@/lib/settings";
import { getPublishedPages } from "@/lib/info-store";
import { getI18n } from "@/lib/locale";
import { prisma } from "@/lib/prisma";

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

  const companyLinks = [
    ...byGroup(["about", "contact"]),
    ...byGroup(["terms", "privacy"]),
  ];

  const helpLinks = [
    { href: "/track", label: t.orderDone.trackHint },
    ...byGroup(["faq", "shipping", "returns", "warranty"]),
  ];

  return (
    // No top margin. A margin cannot be painted, so `mt-16` left a 4rem band
    // of the page background between two `bg-surface` blocks — on the home
    // page that read as a black stripe above the footer in dark mode. The
    // separation is now the footer's own top rule plus its internal padding,
    // which is surface-coloured and therefore invisible as a seam.
    <footer className="border-t border-line bg-surface">
      <div className="page-container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5 lg:py-14">
        <div className="lg:col-span-2">
          <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
            <LogoMark size={36} />
            <Wordmark name={settings.name} className="text-lg" />
          </Link>

          <p className="max-w-sm text-sm leading-relaxed text-ink-500">{t.footer.about}</p>
        </div>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="mb-3.5 text-sm font-bold text-ink-900">
            {t.footer.shop}
          </h2>
          <ul className="flex flex-col">
            {categories.map((category) => (
              <li key={category.slug}>
                <FooterLink href={`/catalog?category=${category.slug}`}>
                  {locale === "ka" ? category.nameKa : category.nameEn}
                </FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-company">
          <h2 id="footer-company" className="mb-3.5 text-sm font-bold text-ink-900">
            {t.footer.company}
          </h2>
          <ul className="flex flex-col">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <FooterLink href={link.href}>{link.label}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="mb-3.5 text-sm font-bold text-ink-900">
            {t.footer.help}
          </h2>
          <ul className="flex flex-col">
            {helpLinks.map((link) => (
              <li key={link.href}>
                <FooterLink href={link.href}>{link.label}</FooterLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="page-container flex flex-col items-center justify-between gap-2 py-5 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} {settings.name}. {t.footer.rights}
          </p>

          <p className="text-xs text-ink-400">{t.footer.demoNote}</p>
        </div>
      </div>
    </footer>
  );
}

/**
 * A footer link that fills its row.
 *
 * The text is 19px tall and the rows were 34px apart, so half of every row was
 * dead space a thumb could land in and nothing would happen. `min-h-11` is 44px
 * — what Apple and Google both ask for — and the list's `gap` is removed to pay
 * for it, so the rows keep roughly the spacing they had while the target more
 * than doubles.
 *
 * Worth being precise about what this does and does not fix: these links were
 * never a WCAG failure. SC 2.5.8 lets an undersized target pass when a 24px
 * circle on its centre touches no other target's, and at 34px apart these
 * cleared that comfortably. This is an ergonomic improvement, not a conformance
 * one, and the roadmap said otherwise until it was measured properly.
 */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center text-sm text-ink-500 transition-colors hover:text-brand-600"
    >
      {children}
    </Link>
  );
}
