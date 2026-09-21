"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { LOCALES, type Locale } from "@/lib/i18n";
import { logout } from "@/app/actions/auth";
import { Overlay } from "@/components/ui/Overlay";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  GridIcon,
  HeartIcon,
  InfoIcon,
  LogoutIcon,
  MailIcon,
  PackageIcon,
  TagIcon,
  UserIcon,
} from "@/components/ui/icons";
import type { HeaderCategory } from "@/components/layout/HeaderBar";

export type MenuLink = { href: string; label: string; icon: "catalog" | "deals" | "favorites" | "track" | "about" | "contact" };

const LINK_ICONS = {
  catalog: GridIcon,
  deals: TagIcon,
  favorites: HeartIcon,
  track: PackageIcon,
  about: InfoIcon,
  contact: MailIcon,
};

/**
 * The menu that slides in from the left on a phone.
 *
 * Three parts: the categories, the site's pages, and the account. The
 * categories fold — nine of them, each a full row, filled the whole panel
 * and put every other link below the fold, so the heading is a control:
 * tap it and the list closes on itself with the chevron turning, tap again
 * and it opens. The fold is a grid row going from `1fr` to `0fr`, which
 * is the one way CSS animates a height it does not know, and it eases
 * rather than snaps.
 *
 * A long category name wraps to a second line rather than being cut: an
 * ellipsis in a menu of nine reads as a fault, and two lines still read
 * as one row because the icon and the chevron are centred on it.
 */
export function MobileMenu({
  open,
  onClose,
  shopName,
  categories,
  categoryName,
  links,
  isCurrent,
  account,
  signedIn,
  locale,
  setLocale,
  t,
}: {
  open: boolean;
  onClose: () => void;
  shopName: string;
  categories: HeaderCategory[];
  categoryName: (category: HeaderCategory) => string;
  links: MenuLink[];
  isCurrent: (href: string) => boolean;
  account: { href: string; label: string };
  signedIn: boolean;
  locale: Locale;
  setLocale: (code: Locale) => void;
  t: { menu: string; close: string; categories: string; signOut: string };
}) {
  const [folded, setFolded] = useState(false);
  const listId = useId();

  const row = (current: boolean) =>
    `menu-row flex min-h-11 items-center gap-3 rounded-control px-3 py-1.5 text-sm font-medium transition-colors ${
      current ? "bg-brand-50 text-brand-700" : "text-ink-800 hover:bg-ink-100"
    }`;

  return (
    <Overlay
      open={open}
      onClose={onClose}
      side="left"
      closeLabel={t.close}
      label={t.menu}
      className="w-[20rem] max-w-[86vw] bg-surface shadow-pop"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line pr-2 pl-4">
        <span className="flex items-center gap-2.5">
          <LogoMark size={30} />
          <Wordmark name={shopName} className="text-base" />
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="btn btn-ghost h-10 w-10 rounded-control p-0"
        >
          <CloseIcon size={20} />
        </button>
      </div>

      <nav aria-label={t.menu} className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {/* The categories, under a heading that folds them. */}
        <button
          type="button"
          onClick={() => setFolded((value) => !value)}
          aria-expanded={!folded}
          aria-controls={listId}
          className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left transition-colors hover:bg-ink-50"
        >
          <span className="flex-1 text-xs font-bold tracking-wider text-ink-500 uppercase">
            {t.categories}
          </span>
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-600 tabular-nums">
            {categories.length}
          </span>
          <ChevronDownIcon
            size={16}
            className={`menu-chevron text-ink-400 ${folded ? "-rotate-90" : ""}`}
          />
        </button>

        <div id={listId} className="menu-fold" data-folded={folded}>
          <div className="menu-fold-inner">
            <ul className="flex flex-col gap-0.5 pt-1 pb-2">
              {categories.map((category) => {
                const href = `/catalog?category=${category.slug}`;
                const name = categoryName(category);
                return (
                  <li key={category.slug}>
                    <Link
                      href={href}
                      title={name}
                      aria-current={isCurrent(href) ? "page" : undefined}
                      tabIndex={folded ? -1 : undefined}
                      className={row(isCurrent(href))}
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-ink-50 text-base"
                      >
                        {category.icon}
                      </span>
                      {/* Two lines at most, rather than an ellipsis: "ტელეფონები
                          და აქსესუარები" cut to "ტელეფონები და აქსესუ…" read as
                          a mistake, not a list. */}
                      <span className="line-clamp-2 min-w-0 flex-1 leading-snug">{name}</span>
                      <ChevronRightIcon size={14} className="shrink-0 text-ink-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mx-3 my-2 h-px bg-line" />

        <ul className="flex flex-col gap-0.5">
          {links.map((link) => {
            const Icon = LINK_ICONS[link.icon];
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  className={row(isCurrent(link.href))}
                >
                  <Icon size={17} className="shrink-0 text-ink-400" />
                  <span className="min-w-0 flex-1 truncate">{link.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link href={account.href} className={row(isCurrent(account.href))}>
              <UserIcon size={17} className="shrink-0 text-ink-400" />
              <span className="min-w-0 flex-1 truncate">{account.label}</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className="flex shrink-0 flex-col gap-3 border-t border-line p-4">
        {signedIn && (
          <form action={logout}>
            <button
              type="submit"
              className="btn btn-outline btn-sm w-full hover:border-danger hover:text-danger"
            >
              <LogoutIcon size={15} />
              {t.signOut}
            </button>
          </form>
        )}

        {/* One control with two halves, the chosen half filled. */}
        <div className="grid grid-cols-2 gap-1 rounded-control bg-ink-100 p-1">
          {LOCALES.map((code: Locale) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={locale === code}
              className={`min-h-9 rounded-[calc(var(--radius-control)-2px)] text-sm font-semibold transition-colors ${
                locale === code
                  ? "bg-surface text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-800"
              }`}
            >
              {code === "ka" ? "ქართული" : "English"}
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}
