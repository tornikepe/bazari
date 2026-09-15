"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { logout } from "@/app/actions/auth";
import { recentOrders, type RecentOrder } from "@/app/actions/account";
import { HoverPanel } from "@/components/layout/HoverPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatPrice } from "@/lib/format";
import { isStaff, type Role } from "@/lib/auth-roles";
import {
  CardIcon,
  DashboardIcon,
  LogoutIcon,
  UserIcon,
} from "@/components/ui/icons";

export type MenuUser = { name: string; email: string; role: Role } | null;

/**
 * The header's account control: a link that opens a panel under the pointer,
 * the way the cart and the heart do.
 *
 * Signed out, the panel offers the two doors in. A customer sees who they
 * are signed in as, their last few orders with what each came to and where
 * it stands — fetched when the panel first opens, once per session — and
 * the way to the account and out. Staff see the dashboard and the payment
 * methods. The click goes where it always went: sign-in, the account, the
 * dashboard.
 */
export function AccountMenu({ user }: { user: MenuUser }) {
  const { t } = useI18n();

  const href = !user
    ? "/login"
    : isStaff(user.role)
      ? "/dashboard"
      : "/account";
  const label = !user
    ? t.auth.signIn
    : isStaff(user.role)
      ? t.admin.dashboard
      : t.account.title;

  return (
    <HoverPanel
      label={label}
      trigger={
        <Link
          href={href}
          aria-label={label}
          title={label}
          className="btn btn-ghost h-11 w-11 rounded-control p-0"
        >
          <UserIcon size={19} />
        </Link>
      }
    >
      {!user ? (
        <SignedOut />
      ) : isStaff(user.role) ? (
        <StaffPanel user={user} />
      ) : (
        <CustomerPanel user={user} />
      )}
    </HoverPanel>
  );
}

function SignedOut() {
  const { t } = useI18n();
  return (
    <div className="px-5 py-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-pill bg-ink-100 text-ink-400">
        <UserIcon size={22} />
      </span>
      <p className="mt-3 text-sm font-bold text-ink-900">
        {t.account.signedOutTitle}
      </p>
      <p className="mt-1 text-xs text-ink-500">{t.account.signedOutHint}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link href="/login" className="btn btn-primary btn-sm">
          {t.auth.signIn}
        </Link>
        <Link href="/register" className="btn btn-outline btn-sm">
          {t.auth.signUp}
        </Link>
      </div>
    </div>
  );
}

function Who({ user }: { user: NonNullable<MenuUser> }) {
  const initials = (user.name || user.email)
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-solid text-sm font-extrabold text-brand-on-solid">
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink-900">
          {user.name || user.email}
        </p>
        <p className="truncate text-xs text-ink-400">{user.email}</p>
      </div>
    </div>
  );
}

function SignOut() {
  const { t } = useI18n();
  return (
    /* A form, not a link — signing out is a mutation. */
    <form action={logout}>
      <button
        type="submit"
        className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <LogoutIcon size={16} className="shrink-0 text-ink-400" />
        {t.auth.signOut}
      </button>
    </form>
  );
}

function StaffPanel({ user }: { user: NonNullable<MenuUser> }) {
  const { t } = useI18n();
  const links = [
    { href: "/dashboard", label: t.admin.dashboard, icon: DashboardIcon },
    {
      href: "/dashboard/payments",
      label: t.admin.paymentMethods,
      icon: CardIcon,
    },
  ];
  return (
    <>
      <Who user={user} />
      <ul className="p-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <link.icon size={16} className="shrink-0 text-ink-400" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-line p-1.5">
        <SignOut />
      </div>
    </>
  );
}

/**
 * Orders already fetched this session, and whose — the panel opens more
 * than once, and a different account signing in on the same tab must not
 * be shown the last one's.
 */
let known: { email: string; rows: RecentOrder[] } | null = null;

function CustomerPanel({ user }: { user: NonNullable<MenuUser> }) {
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState<RecentOrder[] | null>(
    known?.email === user.email ? known.rows : null,
  );

  useEffect(() => {
    if (known?.email === user.email) return;
    let live = true;
    recentOrders()
      .then((rows) => {
        known = { email: user.email, rows };
        if (live) setOrders(rows);
      })
      .catch(() => {
        if (live) setOrders([]);
      });
    return () => {
      live = false;
    };
  }, [user.email]);

  return (
    <>
      <Who user={user} />

      <div className="px-4 pt-3 pb-1">
        <p className="text-xs font-bold tracking-wider text-ink-400 uppercase">
          {t.account.recentOrders}
        </p>
      </div>

      {orders === null ? (
        <ul className="divide-y divide-line" aria-busy>
          {[0, 1, 2].map((index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="flex flex-col gap-1.5">
                <span className="skeleton h-3 w-24 rounded-sm" />
                <span className="skeleton h-3 w-16 rounded-sm" />
              </span>
              <span className="skeleton h-4 w-14 rounded-sm" />
            </li>
          ))}
        </ul>
      ) : orders.length === 0 ? (
        <p className="px-4 pb-3 text-sm text-ink-500">{t.account.noOrders}</p>
      ) : (
        <ul className="divide-y divide-line">
          {orders.map((order) => (
            <li key={order.number}>
              <Link
                href={`/order/${order.number}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-ink-50"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-xs font-bold text-ink-900">
                    {order.number}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {formatDate(order.createdAt)} ·{" "}
                    <span
                      className={
                        order.paymentStatus === "paid" ? "text-success" : ""
                      }
                    >
                      {t.payment[order.paymentStatus]}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold text-ink-900 tabular-nums">
                    {formatPrice(order.total, locale)}
                  </span>
                  <StatusBadge status={order.status} t={t} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line bg-canvas p-1.5">
        <Link
          href="/account"
          className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-900"
        >
          <UserIcon size={16} className="shrink-0 text-ink-400" />
          {t.account.title}
        </Link>
        <SignOut />
      </div>
    </>
  );
}
