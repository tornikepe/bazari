"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LocaleToggle } from "@/components/ui/LocaleToggle";
import { LogoMark } from "@/components/ui/Logo";
import { Overlay } from "@/components/ui/Overlay";
import type { Role } from "@/lib/auth-roles";
import {
  BagIcon,
  CloseIcon,
  DashboardIcon,
  GridIcon,
  TagIcon,
  LogoutIcon,
  MenuIcon,
  PackageIcon,
  FileIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/ui/icons";

export function AdminSidebar({
  admin,
}: {
  admin: { name: string; email: string; role: Role };
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: t.admin.dashboard, icon: DashboardIcon, exact: true },
    { href: "/dashboard/products", label: t.admin.products, icon: PackageIcon },
    { href: "/dashboard/categories", label: t.admin.categories, icon: GridIcon },
    { href: "/dashboard/orders", label: t.admin.orders, icon: BagIcon },
    { href: "/dashboard/coupons", label: t.admin.coupons, icon: TagIcon },
    { href: "/dashboard/customers", label: t.admin.customers, icon: UsersIcon },
    { href: "/dashboard/staff", label: t.admin.staff, icon: ShieldIcon },
    { href: "/dashboard/pages", label: t.admin.pages, icon: FileIcon },
    { href: "/dashboard/settings", label: t.admin.settings, icon: SettingsIcon },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <>
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <LogoMark size={36} />
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
                active ? "bg-brand-solid text-brand-on-solid" : "text-panel-muted hover:bg-panel-fg/10 hover:text-panel-fg"
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

          {/* The same control as the storefront header, in its dark-panel
              variant — one language switch on the site, not two that drift. */}
          <LocaleToggle tone="panel" className="ml-auto" />
        </div>

        <div className="px-2">
          <p className="truncate text-xs font-semibold text-panel-fg">{admin.name}</p>
          <p className="truncate text-xs text-panel-muted">{admin.email}</p>
          {/* Named here rather than only on the pages: a viewer who cannot find
              the edit buttons should be able to see why without navigating. */}
          <p className="mt-1 text-xs font-semibold text-panel-muted">
            {admin.role === "viewer" ? t.admin.roleViewer : t.admin.roleAdmin}
          </p>
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
      <aside className="admin-rail sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-panel p-4 lg:flex">
        {nav}
      </aside>

      {/* Mobile drawer */}
      <div className="lg:hidden">
        <Overlay
          open={open}
          onClose={() => setOpen(false)}
          side="left"
          closeLabel={t.nav.close}
          label={t.nav.menu}
          className="w-64 max-w-[85vw] bg-panel p-4 shadow-pop"
        >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.nav.close}
              className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-control text-panel-muted hover:bg-panel-fg/10 hover:text-panel-fg"
            >
              <CloseIcon size={18} />
            </button>
            {nav}
        </Overlay>
      </div>
    </>
  );
}
