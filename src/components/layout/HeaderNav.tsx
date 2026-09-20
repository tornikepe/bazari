"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { isCurrentPage } from "@/lib/current-page";
import type { MenuLink } from "@/components/layout/MobileMenu";

/**
 * The site's pages, in the desktop header.
 *
 * On a phone the drawer carries the categories and the pages; on a desktop
 * the pages sit in the bar itself, between the logo and the icons, as small
 * capitals with a hairline drawn under the one the page is on. The
 * categories are the catalogue's rail and the home page's tiles.
 */
export function HeaderNav({ links }: { links: MenuLink[] }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (href: string) => isCurrentPage(href, pathname, searchParams.toString());

  return (
    <nav aria-label={t.nav.menu} className="hidden items-center lg:flex">
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={current(item.href) ? "page" : undefined}
          className={`nav-link ${current(item.href) ? "is-current" : ""}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
