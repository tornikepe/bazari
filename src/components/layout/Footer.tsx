import Link from "next/link";
import { getI18n } from "@/lib/locale";
import { prisma } from "@/lib/prisma";
import { RefreshIcon, ShieldIcon, TruckIcon } from "@/components/ui/icons";

export async function Footer() {
  const { locale, t } = await getI18n();

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }],
    take: 6,
    select: { slug: true, nameKa: true, nameEn: true },
  });

  const perks = [
    { icon: TruckIcon, label: t.topbar.shipping },
    { icon: ShieldIcon, label: t.home.why4Title },
    { icon: RefreshIcon, label: t.home.why3Title },
  ];

  const companyLinks = [
    { href: "/about", label: t.nav.about },
    { href: "/contact", label: t.nav.contact },
    { href: "/terms", label: t.footer.terms },
    { href: "/privacy", label: t.footer.privacy },
  ];

  const helpLinks = [
    { href: "/track", label: t.orderDone.trackHint },
    { href: "/faq", label: t.footer.faq },
    { href: "/shipping", label: t.footer.shippingInfo },
    { href: "/returns", label: t.footer.returns },
    { href: "/warranty", label: t.footer.warranty },
  ];

  return (
    <footer className="mt-16 border-t border-line bg-surface">
      {/* Perks strip */}
      <div className="border-b border-line bg-ink-50">
        <div className="page-container grid gap-4 py-6 sm:grid-cols-3">
          {perks.map((perk) => (
            <div key={perk.label} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-surface text-brand-600 shadow-card">
                <perk.icon size={19} />
              </span>
              <span className="text-xs leading-snug font-medium text-ink-700">
                {perk.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="page-container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Link href="/" className="mb-4 inline-flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-control bg-brand-600 text-base font-black text-white">
              ბ
            </span>
            <span className="text-lg font-extrabold tracking-tight text-ink-900">
              Ba<span className="text-brand-600">zari</span>
            </span>
          </Link>

          <p className="max-w-sm text-sm leading-relaxed text-ink-500">{t.footer.about}</p>
        </div>

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className="mb-3.5 text-sm font-bold text-ink-900">
            {t.footer.shop}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/catalog?category=${category.slug}`}
                  className="text-sm text-ink-500 transition-colors hover:text-brand-600"
                >
                  {locale === "ka" ? category.nameKa : category.nameEn}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-company">
          <h2 id="footer-company" className="mb-3.5 text-sm font-bold text-ink-900">
            {t.footer.company}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {companyLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-ink-500 transition-colors hover:text-brand-600"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-help">
          <h2 id="footer-help" className="mb-3.5 text-sm font-bold text-ink-900">
            {t.footer.help}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {helpLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-ink-500 transition-colors hover:text-brand-600"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="page-container flex flex-col items-center justify-between gap-2 py-5 text-center sm:flex-row sm:text-left">
          <p className="text-xs text-ink-400">
            © {new Date().getFullYear()} Bazari. {t.footer.rights}
          </p>

          <p className="text-xs text-ink-400">{t.footer.demoNote}</p>
        </div>
      </div>
    </footer>
  );
}
