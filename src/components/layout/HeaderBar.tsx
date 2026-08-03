"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCart } from "@/components/providers/CartProvider";
import { useI18n } from "@/components/providers/I18nProvider";
import { useFavorites } from "@/components/product/FavoriteButton";
import { LOCALES, type Locale } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { logout } from "@/app/actions/auth";
import {
  CartIcon,
  CloseIcon,
  HeartIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  TruckIcon,
  UserIcon,
} from "@/components/ui/icons";

export type HeaderCategory = {
  slug: string;
  nameKa: string;
  nameEn: string;
  icon: string;
};

export type HeaderUser = { name: string; email: string; role: "customer" | "admin" } | null;

export function HeaderBar({
  categories,
  user,
}: {
  categories: HeaderCategory[];
  user: HeaderUser;
}) {
  const { locale, t, setLocale } = useI18n();
  const { count, hydrated } = useCart();
  const favorites = useFavorites();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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

  // A drawer that scrolls the page behind it feels broken on mobile.
  useEffect(() => {
    if (!menuOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/catalog?q=${encodeURIComponent(trimmed)}` : "/catalog");
    searchRef.current?.blur();
    setSearchOpen(false);
  }

  // Signed out -> sign in; customer -> their account; staff -> the dashboard.
  const accountHref = !user ? "/login" : user.role === "admin" ? "/dashboard" : "/account";
  const accountLabel = !user
    ? t.auth.signIn
    : user.role === "admin"
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
      {/* Announcement strip */}
      <div className="hidden bg-panel text-panel-fg lg:block">
        <div className="page-container flex h-9 items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <TruckIcon size={14} className="text-brand-400" />
              {t.topbar.shipping}
            </span>
            <span className="text-ink-400">{t.topbar.delivery}</span>
          </div>

          <div className="flex items-center gap-1">
            {LOCALES.map((code: Locale) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                aria-pressed={locale === code}
                // Fixed width: "ქარ" and "EN" are different lengths, and
                // without this the strip's contents shuffle on every switch.
                className={`w-11 rounded py-0.5 text-center font-semibold transition-colors ${
                  locale === code
                    ? "bg-panel-fg/15 text-panel-fg"
                    : "text-panel-muted hover:text-panel-fg"
                }`}
              >
                {code === "ka" ? "ქარ" : "EN"}
              </button>
            ))}
          </div>
        </div>
      </div>

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

        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-brand-solid text-base font-black text-brand-on-solid shadow-sm">
            ბ
          </span>
          <span className="hidden text-lg leading-none font-extrabold tracking-tight text-ink-900 sm:block">
            Ba<span className="text-brand-600">zari</span>
          </span>
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
            className="field h-11 rounded-pill pl-10 pr-24"
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm absolute top-1/2 right-1.5 h-8 w-20 -translate-y-1/2 rounded-pill px-0"
          >
            {t.nav.search}
          </button>
        </form>

        {/* Pushes the actions to the right where the bar is hidden. */}
        <div className="flex-1 md:hidden" />

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label={t.nav.search}
            title={t.nav.search}
            className="btn btn-ghost h-10 w-10 rounded-control p-0 md:hidden"
          >
            <SearchIcon size={19} />
          </button>

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
            className="btn btn-ghost relative hidden h-10 w-10 rounded-control p-0 min-[360px]:flex"
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
            className="btn btn-ghost relative h-10 w-10 rounded-control p-0"
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

      {/* Category rail */}
      <nav className="rail-fade hidden border-t border-line lg:block">
        <div className="page-container rail flex h-11 items-center gap-1 overflow-x-auto">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/catalog?category=${category.slug}`}
              className="flex shrink-0 items-center gap-1.5 rounded-control px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <span aria-hidden="true">{category.icon}</span>
              {categoryName(category)}
            </Link>
          ))}

          <span className="mx-2 h-4 w-px shrink-0 bg-line" />

          {navLinks.slice(1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-control px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile search overlay */}
      {searchOpen && (
        <div className="absolute inset-x-0 top-0 z-50 bg-surface p-3 shadow-card md:hidden">
          <form onSubmit={submitSearch} className="flex items-center gap-2" role="search">
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                size={17}
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
              />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.nav.searchPlaceholder}
                aria-label={t.nav.search}
                className="field h-11 rounded-pill pl-10"
              />
            </div>

            <button type="submit" className="btn btn-primary btn-md shrink-0 rounded-pill">
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
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t.nav.close}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
          />

          <div className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col bg-surface shadow-pop">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <span className="text-base font-extrabold tracking-tight text-ink-900">
                Ba<span className="text-brand-600">zari</span>
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
                {categories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={`/catalog?category=${category.slug}`}
                      className="flex items-center gap-2.5 rounded-control px-2.5 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
                    >
                      <span className="text-base" aria-hidden="true">
                        {category.icon}
                      </span>
                      {categoryName(category)}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="h-px bg-line" />

              <ul className="mt-4 flex flex-col gap-0.5">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block rounded-control px-2.5 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
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
          </div>
        </div>
      )}
    </header>
  );
}
