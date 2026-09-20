"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import { isStaff, type Role } from "@/lib/auth-roles";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LocaleToggle } from "@/components/ui/LocaleToggle";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { useSettings } from "@/components/providers/SettingsProvider";
import { SearchSuggestions } from "@/components/layout/SearchSuggestions";
import { isCurrentPage } from "@/lib/current-page";
import { useOverlay } from "@/lib/use-overlay";
import { AccountMenu } from "@/components/layout/AccountMenu";
import {
  CartIcon,
  CloseIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { useChangeKey } from "@/components/ui/useChangeKey";
import { useScrolled } from "@/components/layout/useScrolled";
import { HoverPanel } from "@/components/layout/HoverPanel";
import { MiniCart } from "@/components/layout/MiniCart";
import { MiniFavorites } from "@/components/layout/MiniFavorites";
import { MobileMenu, type MenuLink } from "@/components/layout/MobileMenu";
import { HeaderNav } from "@/components/layout/HeaderNav";

export type HeaderCategory = {
  slug: string;
  nameKa: string;
  nameEn: string;
  icon: string;
};

export type HeaderUser = { name: string; email: string; role: Role; avatarUrl: string | null } | null;

export function HeaderBar({
  categories,
  user,
}: {
  categories: HeaderCategory[];
  user: HeaderUser;
}) {
  const { locale, t, setLocale } = useI18n();
  const settings = useSettings();
  const { count, hydrated } = useCart();

  /* Both badges bounce when their number changes and stay still on load. */
  const cartBump = useChangeKey(count, hydrated);
  const favorites = useFavorites();
  const savedBump = useChangeKey(favorites.length, hydrated);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const { mounted: searchMounted, state: searchState } = useOverlay(searchOpen, {
    duration: 220,
  });

  // Both of these track external values (the URL), so they're adjusted during
  // render instead of in an effect — React re-runs the component right away
  // rather than committing the stale value first.
  const urlQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);

  if (lastUrlQuery !== urlQuery) {
    setLastUrlQuery(urlQuery);
    setQuery(urlQuery);
  }

  // Route changes should always close the drawer.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/catalog?q=${encodeURIComponent(trimmed)}` : "/catalog");
    mobileSearchRef.current?.blur();
    setSearchOpen(false);
  }

  // Signed out -> sign in; customer -> their account; staff -> the dashboard.
  const accountHref = !user ? "/login" : isStaff(user.role) ? "/dashboard" : "/account";
  const accountLabel = !user
    ? t.auth.signIn
    : isStaff(user.role)
      ? t.admin.dashboard
      : t.account.title;

  const categoryName = (category: HeaderCategory) =>
    locale === "ka" ? category.nameKa : category.nameEn;

  const navLinks: MenuLink[] = [
    { href: "/catalog", label: t.nav.catalog, icon: "catalog" },
    { href: "/catalog?sale=1", label: t.nav.deals, icon: "deals" },
    { href: "/favorites", label: t.favorites.title, icon: "favorites" },
    { href: "/track", label: t.track.title, icon: "track" },
    { href: "/about", label: t.nav.about, icon: "about" },
    { href: "/contact", label: t.nav.contact, icon: "contact" },
  ];

  return (
    <header
      data-scrolled={scrolled}
      data-glass={pathname === "/"}
      className="site-header sticky top-0 z-40 bg-surface"
    >
      {/* One bar: the menu button and the logo, the pages in the middle
          from `lg`, the icons at the end. The search is an icon on every
          width and opens a sheet over the bar — a box in the bar was the
          one thing pulling the composition off centre. */}
      <div className="page-container flex h-16 items-center gap-2 sm:gap-3 lg:h-[4.75rem] lg:gap-8">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t.nav.menu}
          aria-expanded={menuOpen}
          className="btn btn-ghost -ml-2 h-10 w-10 shrink-0 rounded-control p-0 lg:hidden"
        >
          <MenuIcon size={22} />
        </button>

        <Link href="/" aria-label={t.nav.home} className="flex shrink-0 items-center gap-2.5">
          <LogoMark size={34} />
          <Wordmark name={settings.name} className="hidden text-lg sm:block" />
        </Link>

        {/* The shop's pages only: about and contact live in the footer
            and the drawer, and six links beside the icons overran 1280px. */}
        <HeaderNav links={navLinks.filter((item) => ["catalog", "deals", "track"].includes(item.icon))} />

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t.nav.search}
            title={t.nav.search}
            className="btn btn-ghost h-11 w-11 rounded-control p-0"
          >
            <SearchIcon size={19} />
          </button>

          {/* Moved up from the strip that used to sit above this bar. Hidden
              on phones, where the drawer carries the full-word version — five
              icon buttons plus a two-segment control do not fit 360px. */}
          <LocaleToggle className="mr-1 hidden sm:flex" />

          <ThemeToggle className="btn btn-ghost" />

          {/* Icon-only, so the cluster's width doesn't depend on how long
              "ანგარიში" vs "Account" happens to be. */}
          <AccountMenu user={user} />

          {/* The heart and the cart each open a panel under the pointer —
              the list itself, in brief — and stay links: a click goes to the
              page as it always did. Hidden on the narrowest phones: five
              icon buttons plus the logo overflow 320px. The drawer still
              links to it. */}
          <HoverPanel
            label={t.favorites.title}
            className="hidden min-[360px]:block"
            trigger={
              <Link
                href="/favorites"
                title={t.favorites.title}
                aria-label={t.favorites.title}
                className="btn btn-ghost relative flex h-11 w-11 rounded-control p-0"
              >
                <span className="relative">
                  <HeartIcon size={20} />
                  {/* Only after hydration — the server can't know the wishlist. */}
                  {hydrated && favorites.length > 0 && (
                    <span
                      key={savedBump}
                      className={`absolute -top-2 -right-2.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-pill bg-brand-solid px-1 text-xs font-bold text-brand-on-solid ${
                        savedBump > 0 ? "animate-bump" : ""
                      }`}
                    >
                      {favorites.length > 99 ? "99+" : favorites.length}
                    </span>
                  )}
                </span>
              </Link>
            }
          >
            <MiniFavorites />
          </HoverPanel>

          <HoverPanel
            label={t.nav.cart}
            trigger={
              <Link
                href="/cart"
                aria-label={t.nav.cart}
                title={t.nav.cart}
                className="btn btn-ghost relative h-11 w-11 rounded-control p-0"
              >
                <span className="relative">
                  <CartIcon size={21} />
                  {/* Rendered only after hydration — the server has no cart. */}
                  {hydrated && count > 0 && (
                    /* Keyed on the change, so the badge remounts and replays the
                       bump. Adding something from a product page changes a number
                       in the corner of the screen and nothing else; without this
                       the only feedback is a digit quietly becoming another digit. */
                    <span
                      key={cartBump}
                      className={`absolute -top-2 -right-2.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-pill bg-brand-solid px-1 text-xs font-bold text-brand-on-solid ${
                        cartBump > 0 ? "animate-bump" : ""
                      }`}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
              </Link>
            }
          >
            <MiniCart />
          </HoverPanel>
        </div>
      </div>

      {/* The search: a sheet that slides down over the bar rather than
          replacing it in one frame — it covers the control that opened it,
          so an instant swap leaves no clue where the bar went. */}
      {searchMounted && (
        <div
          data-state={searchState}
          className="search-sheet absolute inset-x-0 top-0 z-50 border-b border-line bg-surface p-3 shadow-pop"
        >
          <form
            onSubmit={submitSearch}
            className="page-container flex items-center gap-2"
            role="search"
          >
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                size={17}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
              />
              <input
                ref={mobileSearchRef}
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.nav.searchPlaceholder}
                aria-label={t.nav.search}
                className="field h-12 pl-10 text-base"
              />

              <SearchSuggestions
                query={query}
                inputRef={mobileSearchRef}
                onNavigate={() => setSearchOpen(false)}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-md shrink-0">
              {t.nav.search}
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label={t.nav.close}
              className="btn btn-ghost h-10 w-10 shrink-0 rounded-control p-0"
            >
              <CloseIcon size={19} />
            </button>
          </form>
        </div>
      )}

      <MobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        shopName={settings.name}
        categories={categories}
        categoryName={categoryName}
        links={navLinks}
        isCurrent={(href) => isCurrentPage(href, pathname, searchParams.toString())}
        account={{ href: accountHref, label: accountLabel }}
        signedIn={Boolean(user)}
        locale={locale}
        setLocale={setLocale}
        t={{
          menu: t.nav.menu,
          close: t.nav.close,
          categories: t.nav.categories,
          signOut: t.auth.signOut,
        }}
      />
    </header>
  );
}
