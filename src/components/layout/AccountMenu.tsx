"use client";

import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { logout } from "@/app/actions/auth";
import { HoverPanel } from "@/components/layout/HoverPanel";
import { isStaff, type Role } from "@/lib/auth-roles";
import {
  CardIcon,
  DashboardIcon,
  LogoutIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/ui/icons";

export type MenuUser = {
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
} | null;

/**
 * The header's account control: a link that opens a panel under the pointer,
 * the way the cart and the heart do.
 *
 * Signed out, the panel offers the two doors in. A customer sees who they
 * are signed in as and the three pages that are theirs — the account, its
 * settings, its payment page — and the way out. Staff see the dashboard and
 * the payment methods. The click goes where it always went: sign-in, the
 * account, the dashboard.
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
      width="w-64"
      trigger={
        <Link
          href={href}
          aria-label={label}
          title={label}
          className="btn btn-ghost h-11 w-11 rounded-control p-0"
        >
          {user?.avatarUrl ? (
            <Avatar url={user.avatarUrl} size={28} />
          ) : (
            <UserIcon size={19} />
          )}
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

/** The customer's picture, round, at the size the place asks for. */
function Avatar({ url, size }: { url: string; size: number }) {
  return (
    // A plain `img`: the bytes come from this app's own route and are
    // already the size they will be shown at, so there is nothing for the
    // optimiser to do but stand in the way.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-pill object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function SignedOut() {
  const { t } = useI18n();
  return (
    <div className="px-4 py-5 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-pill bg-ink-100 text-ink-400">
        <UserIcon size={20} />
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
    <div className="flex items-center gap-3 border-b border-line px-3.5 py-3">
      {user.avatarUrl ? (
        <Avatar url={user.avatarUrl} size={40} />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-brand-solid text-sm font-extrabold text-brand-on-solid">
          {initials}
        </span>
      )}
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

function CustomerPanel({ user }: { user: NonNullable<MenuUser> }) {
  const { t } = useI18n();
  const links = [
    { href: "/account", label: t.account.title, icon: UserIcon },
    {
      href: "/account/settings",
      label: t.account.settings,
      icon: SettingsIcon,
    },
    { href: "/account/payments", label: t.account.payments, icon: CardIcon },
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
