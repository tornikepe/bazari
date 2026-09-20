"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { HoverPanel } from "@/components/layout/HoverPanel";
import { isCurrentPage } from "@/lib/current-page";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/ui/icons";
import type { HeaderCategory } from "@/components/layout/HeaderBar";
import type { MenuLink } from "@/components/layout/MobileMenu";

/**
 * The site's pages, in the desktop header.
 *
 * On a phone the drawer carries the categories and the pages; on a desktop
 * they sit in the bar itself, between the logo and the icons: the
 * categories in a panel that opens under the pointer, the same way the
 * cart does, and the pages as links beside it.
 */
export function HeaderNav({
  categories,
  categoryName,
  links,
}: {
  categories: HeaderCategory[];
  categoryName: (category: HeaderCategory) => string;
  links: MenuLink[];
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (href: string) => isCurrentPage(href, pathname, searchParams.toString());

  const link = (href: string) => `nav-link ${current(href) ? "is-current" : ""}`;
  /* The categories trigger is "current" while any category is being
     browsed, which no single href says. */
  const inCategory = pathname === "/catalog" && searchParams.has("category");

  return (
    /* In the bar itself from `lg`, between the logo and the icons: small
       capitals, a hairline drawn under the one the page is on. */
    <nav aria-label={t.nav.menu} className="hidden items-center lg:flex">
        <HoverPanel
          label={t.nav.categories}
          width="w-[34rem]"
          align="left"
          trigger={
            <Link
              href="/catalog"
              className={`nav-link inline-flex items-center gap-1 ${inCategory ? "is-current" : ""}`}
            >
              {t.nav.categories}
              <ChevronDownIcon size={13} className="text-ink-400" />
            </Link>
          }
        >
          <ul className="grid grid-cols-2 gap-1 p-3">
            {categories.map((category) => {
              const href = `/catalog?category=${category.slug}`;
              return (
                <li key={category.slug}>
                  <Link
                    href={href}
                    aria-current={current(href) ? "page" : undefined}
                    className="group flex min-h-12 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-50 hover:text-brand-600"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-ink-50 text-lg transition-colors group-hover:bg-brand-50"
                    >
                      {category.icon}
                    </span>
                    <span className="min-w-0 flex-1 leading-tight">{categoryName(category)}</span>
                    <ChevronRightIcon
                      size={14}
                      className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line bg-canvas px-4 py-2.5">
            <Link href="/catalog" className="text-xs font-bold text-brand-600 hover:underline">
              {t.home.viewAll} →
            </Link>
          </div>
        </HoverPanel>

        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current(item.href) ? "page" : undefined}
            className={link(item.href)}
          >
            {item.label}
          </Link>
        ))}
    </nav>
  );
}
