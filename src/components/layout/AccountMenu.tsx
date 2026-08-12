"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { logout } from "@/app/actions/auth";
import { Popover } from "@/components/ui/Overlay";
import { isStaff, type Role } from "@/lib/auth-roles";
import {
  DashboardIcon,
  LogoutIcon,
  UserIcon,
} from "@/components/ui/icons";

export type MenuUser = { name: string; email: string; role: Role } | null;

/**
 * The header's account control.
 *
 * Signed out it's a plain link to sign-in. Signed in it opens a menu, so
 * settings, the dashboard and — importantly — signing out are reachable from
 * every page rather than only from the account screen.
 */
export function AccountMenu({ user }: { user: MenuUser }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigating away should never leave the menu hanging open.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <Link
        href="/login"
        aria-label={t.auth.signIn}
        title={t.auth.signIn}
        className="btn btn-ghost h-11 w-11 rounded-control p-0"
      >
        <UserIcon size={19} />
      </Link>
    );
  }

  /**
   * One destination for a customer, not three.
   *
   * "My orders" and "Settings" were both anchors into `/account` — the same
   * page the first entry already opens. A menu whose three items lead to one
   * place asks the reader to choose between things that are not choices, and
   * the page's own headings do that job better once they are on it.
   */
  const links = isStaff(user.role)
    ? [{ href: "/dashboard", label: t.admin.dashboard, icon: DashboardIcon }]
    : [{ href: "/account", label: t.account.title, icon: UserIcon }];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.account.title}
        title={t.account.title}
        className={`btn btn-ghost h-11 w-11 rounded-control p-0 ${open ? "bg-ink-100" : ""}`}
      >
        <UserIcon size={19} />
      </button>

      <Popover
        open={open}
        role="menu"
        className="mt-2 w-60 overflow-hidden rounded-card border border-line bg-surface shadow-pop"
      >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold text-ink-900">{user.name || user.email}</p>
            <p className="truncate text-xs text-ink-400">{user.email}</p>
          </div>

          <ul className="p-1.5">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
                >
                  <link.icon size={16} className="shrink-0 text-ink-400" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* A form, not a link — signing out is a mutation. */}
          <form action={logout} className="border-t border-line p-1.5">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <LogoutIcon size={16} className="shrink-0 text-ink-400" />
              {t.auth.signOut}
            </button>
          </form>
      </Popover>
    </div>
  );
}
