"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { HoverPanel } from "@/components/layout/HoverPanel";
import { isCurrentPage } from "@/lib/current-page";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { ChevronDownIcon, ChevronRightIcon, TruckIcon } from "@/components/ui/icons";
import type { HeaderCategory } from "@/components/layout/HeaderBar";
import type { MenuLink } from "@/components/layout/MobileMenu";

/**
 * The row of links under the desktop header.
 *
 * On a phone the drawer carries the categories and the site's pages; on a
 * desktop there was nothing — the search box and five icons, and no way to
 * a category short of the home page. This row is the drawer laid flat:
 * the categories in a panel that opens under the pointer, the same way the
 * cart does, and the pages as links beside it. The delivery rule sits at
 * the far end, read from settings, because it is the one fact every shop
 * puts in its header and the one a visitor looks for first.
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
  const { t, locale } = useI18n();
  const settings = useSettings();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (href: string) => isCurrentPage(href, pathname, searchParams.toString());

  const link = (href: string) =>
    `header-nav-link ${current(href) ? "is-current" : ""}`;
  /* The categories trigger is "current" while any category is being
     browsed, which no single href says. */
  const inCategory = pathname === "/catalog" && searchParams.has("category");

  return (
    <div className="hidden border-t border-line lg:block">
      <div className="page-container flex h-11 items-center gap-1">
        <HoverPanel
          label={t.nav.categories}
          width="w-[34rem]"
          align="left"
          trigger={
            <Link
              href="/catalog"
              className={`header-nav-link pl-0 ${inCategory ? "is-current" : ""}`}
            >
              {t.nav.categories}
              <ChevronDownIcon size={14} className="text-ink-400" />
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

        {/* The delivery rule, as the footer and the cart state it. */}
        {settings.freeShippingThreshold > 0 && (
          <p className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-ink-500">
            <TruckIcon size={15} className="text-brand-600" />
            {fill(t.topbar.shipping, { amount: formatPrice(settings.freeShippingThreshold, locale) })}
          </p>
        )}
      </div>
    </div>
  );
}
