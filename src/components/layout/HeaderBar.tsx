"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import { LOCALES, type Locale } from "@/lib/i18n";
import { isStaff, type Role } from "@/lib/auth-roles";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LocaleToggle } from "@/components/ui/LocaleToggle";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Overlay } from "@/components/ui/Overlay";
import { SearchSuggestions } from "@/components/layout/SearchSuggestions";
import { isCurrentPage } from "@/lib/current-page";
import { useOverlay } from "@/lib/use-overlay";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { logout } from "@/app/actions/auth";
import {
  CartIcon,
  CloseIcon,
  HeartIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/icons";

export type HeaderCategory = {
  slug: string;
  nameKa: string;
  nameEn: string;
  icon: string;
};

export type HeaderUser = { name: string; email: string; role: Role } | null;

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
  const favorites = useFavorites();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  // The phone sheet is a second input, so it needs its own handle — one ref
  // across both would point at whichever mounted last.
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
    searchRef.current?.blur();
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

  const navLinks = [
    { href: "/catalog", label: t.nav.catalog },
    { href: "/catalog?sale=1", label: t.nav.deals },
    { href: "/favorites", label: t.favorites.title },
    { href: "/track", label: t.orderDone.trackHint },
    { href: "/about", label: t.nav.about },
    { href: "/contact", label: t.nav.contact },
  ];

  return (
    <header className="sticky top-0 z-40 bg-surface shadow-[0_1px_0_var(--color-line)]">
      {/* Main bar */}
      <div className="page-container flex h-16 items-center gap-2 sm:gap-3 lg:h-20 lg:gap-6">
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
          <LogoMark size={36} />
          <Wordmark name={settings.name} className="hidden text-lg sm:block" />
        </Link>

        {/* Below `md` the bar is replaced by a single icon that opens a
            full-width overlay — a cramped input squeezed between the logo and
            four action buttons was unusable on a phone. */}
        <form onSubmit={submitSearch} className="relative hidden flex-1 md:block" role="search">
          <SearchIcon
            size={17}
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.nav.searchPlaceholder}
            aria-label={t.nav.search}
            className="field h-11 pl-10 pr-24"
          />
          {/* `min-h-0` is doing real work: `.btn-sm` sets `min-height: 2.25rem`,
              which silently beat the `h-8` here — the button rendered 36px tall
              inside a 44px field, so it sat 4px from the top and bottom but 6px
              from the right. Symmetric now, 6px on every side. */}
          <button
            type="submit"
            className="btn btn-primary btn-sm absolute top-1/2 right-1.5 h-8 min-h-0 w-20 -translate-y-1/2 px-0"
          >
            {t.nav.search}
          </button>

          <SearchSuggestions query={query} inputRef={searchRef} onNavigate={() => setSearchOpen(false)} />
        </form>

        {/* Pushes the actions to the right where the bar is hidden. */}
        <div className="flex-1 md:hidden" />

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t.nav.search}
            title={t.nav.search}
            className="btn btn-ghost h-11 w-11 rounded-control p-0 md:hidden"
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

          <Link
            href="/favorites"
            title={t.favorites.title}
            aria-label={t.favorites.title}
            // Hidden on the narrowest phones: five icon buttons plus the logo
            // overflow 320px. The drawer still links to it.
            className="btn btn-ghost relative hidden h-11 w-11 rounded-control p-0 min-[360px]:flex"
          >
            <span className="relative">
              <HeartIcon size={20} />
              {/* Only after hydration — the server can't know the wishlist. */}
              {hydrated && favorites.length > 0 && (
                <span className="absolute -top-2 -right-2.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-pill bg-brand-solid px-1 text-xs font-bold text-brand-on-solid">
                  {favorites.length > 99 ? "99+" : favorites.length}
                </span>
              )}
            </span>
          </Link>

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
                <span className="absolute -top-2 -right-2.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-pill bg-brand-solid px-1 text-xs font-bold text-brand-on-solid">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile search overlay. Slides down over the bar rather than
          replacing it in one frame — it covers the control that opened it, so
          an instant swap leaves no clue where the bar went. */}
      {searchMounted && (
        <div
          data-state={searchState}
          className="search-sheet absolute inset-x-0 top-0 z-50 bg-surface p-3 shadow-card md:hidden"
        >
          <form onSubmit={submitSearch} className="flex items-center gap-2" role="search">
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
                className="field h-11 pl-10"
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

      {/* Mobile drawer */}
      <div className="lg:hidden">
        <Overlay
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          side="left"
          closeLabel={t.nav.close}
          label={t.nav.menu}
          className="w-[19rem] max-w-[85vw] bg-surface shadow-pop"
        >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <span className="flex items-center gap-2.5">
                <LogoMark size={30} />
                <Wordmark name={settings.name} className="text-base" />
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t.nav.close}
                className="btn btn-ghost h-9 w-9 rounded-control p-0"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <p className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-400 uppercase">
                {t.nav.categories}
              </p>
              <ul className="mb-5 flex flex-col gap-0.5">
                {categories.map((category) => {
                  const href = `/catalog?category=${category.slug}`;
                  const current = isCurrentPage(href, pathname, searchParams.toString());
                  return (
                  <li key={category.slug}>
                    <Link
                      href={href}
                      aria-current={current ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-control px-2.5 py-2.5 text-sm font-medium transition-colors hover:bg-ink-100 ${
                        current ? "bg-ink-100 text-ink-900" : "text-ink-700"
                      }`}
                    >
                      <span className="text-base" aria-hidden="true">
                        {category.icon}
                      </span>
                      {categoryName(category)}
                    </Link>
                  </li>
                  );
                })}
              </ul>

              <div className="h-px bg-line" />

              <ul className="mt-4 flex flex-col gap-0.5">
                {navLinks.map((link) => {
                  const current = isCurrentPage(link.href, pathname, searchParams.toString());
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={current ? "page" : undefined}
                        className={`block rounded-control px-2.5 py-2.5 text-sm font-medium transition-colors hover:bg-ink-100 ${
                          current ? "bg-ink-100 text-ink-900" : "text-ink-700"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link
                    href={accountHref}
                    className="flex items-center gap-2 rounded-control px-2.5 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
                  >
                    <UserIcon size={16} />
                    {accountLabel}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 border-t border-line p-4">
              {user && (
                <form action={logout}>
                  <button
                    type="submit"
                    className="btn btn-outline btn-sm w-full hover:border-danger hover:text-danger"
                  >
                    <LogoutIcon size={15} />
                    {t.auth.signOut}
                  </button>
                </form>
              )}

              <div className="flex items-center gap-1.5">
                {LOCALES.map((code: Locale) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLocale(code)}
                    aria-pressed={locale === code}
                    className={`btn btn-sm flex-1 ${
                      locale === code ? "btn-secondary" : "btn-outline"
                    }`}
                  >
                    {code === "ka" ? "ქართული" : "English"}
                  </button>
                ))}
              </div>
            </div>
        </Overlay>
      </div>
    </header>
  );
}
