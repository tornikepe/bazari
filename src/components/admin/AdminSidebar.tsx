"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LOCALES, type Locale } from "@/lib/i18n";
import {
  BagIcon,
  CloseIcon,
  DashboardIcon,
  GridIcon,
  LogoutIcon,
  MenuIcon,
  PackageIcon,
} from "@/components/ui/icons";

export function AdminSidebar({ admin }: { admin: { name: string; email: string } }) {
  const { locale, t, setLocale } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: t.admin.dashboard, icon: DashboardIcon, exact: true },
    { href: "/dashboard/products", label: t.admin.products, icon: PackageIcon },
    { href: "/dashboard/categories", label: t.admin.categories, icon: GridIcon },
    { href: "/dashboard/orders", label: t.admin.orders, icon: BagIcon },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <span className="grid h-9 w-9 place-items-center rounded-control bg-brand-600 text-base font-black text-white">
          ბ
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-tight text-panel-fg">Bazari</p>
          <p className="truncate text-xs text-panel-muted">{t.admin.dashboard}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active = isActive(link.href, link.exact);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-brand-600 text-white" : "text-panel-muted hover:bg-panel-fg/10 hover:text-panel-fg"
              }`}
            >
              <link.icon size={17} className="shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t border-panel-fg/10 pt-4">
        <div className="flex items-center gap-1">
          <ThemeToggle className="text-panel-muted hover:bg-panel-fg/10 hover:text-panel-fg" />

          {LOCALES.map((code: Locale) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={locale === code}
              className={`flex-1 rounded-control px-2 py-1.5 text-xs font-semibold transition-colors ${
                locale === code ? "bg-panel-fg/15 text-panel-fg" : "text-panel-muted hover:text-panel-fg"
              }`}
            >
              {code === "ka" ? "ქარ" : "EN"}
            </button>
          ))}
        </div>

        <div className="px-2">
          <p className="truncate text-xs font-semibold text-panel-fg">{admin.name}</p>
          <p className="truncate text-xs text-panel-muted">{admin.email}</p>
        </div>

        <Link
          href="/"
          className="flex items-center gap-2 rounded-control px-3 py-2 text-xs font-medium text-panel-muted transition-colors hover:bg-panel-fg/10 hover:text-panel-fg"
        >
          <BagIcon size={15} />
          {t.admin.backToShop}
        </Link>

        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-xs font-medium text-panel-muted transition-colors hover:bg-danger/20 hover:text-panel-fg"
          >
            <LogoutIcon size={15} />
            {t.admin.logout}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.nav.menu}
          className="btn btn-ghost h-9 w-9 rounded-control p-0"
        >
          <MenuIcon size={20} />
        </button>
        <span className="text-sm font-bold text-ink-900">{t.admin.dashboard}</span>
      </div>

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-panel p-4 lg:flex">
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={t.nav.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col bg-panel p-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.nav.close}
              className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-control text-panel-muted hover:bg-panel-fg/10 hover:text-panel-fg"
            >
              <CloseIcon size={18} />
            </button>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
