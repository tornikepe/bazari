"use client";

import Link from "next/link";
import { useI18n } from "@/components/providers/I18nProvider";
import { logout } from "@/app/actions/auth";
import { HoverPanel } from "@/components/layout/HoverPanel";
import { MiniLogin } from "@/components/auth/MiniLogin";
import { isStaff, type Role } from "@/lib/auth-roles";
import { initialsOf } from "@/components/account/initials";
import {
  CardIcon,
  ChevronRightIcon,
  ClockIcon,
  DashboardIcon,
  LogoutIcon,
  MapPinIcon,
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
export function AccountMenu({ user, social }: { user: MenuUser; social?: React.ReactNode }) {
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
      /* A form wants a little more room than a list of links; the
         customer's list, with its six rows, a little more still. */
      width={!user ? "w-[19rem]" : isStaff(user.role) ? "w-64" : "w-80"}
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
        <SignedOut social={social} />
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

/* Signed out, the panel *is* the sign-in: the form itself, not two doors
   to it — see `MiniLogin`. */
function SignedOut({ social }: { social?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <div className="border-b border-line px-4 py-3 text-center">
        <p className="text-sm font-bold text-ink-900">{t.account.signedOutTitle}</p>
        <p className="mt-0.5 text-xs text-ink-500">{t.account.signedOutHint}</p>
      </div>
      <MiniLogin social={social} />
    </>
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
  const initials = initialsOf(user.name, user.email);
  /* The same rows as the account page's own menu, in the same order. */
  const links = [
    { href: "/account", label: t.account.menuProfile, icon: UserIcon },
    { href: "/account/addresses", label: t.account.menuAddresses, icon: MapPinIcon },
    { href: "/account/orders", label: t.account.menuOrders, icon: ClockIcon },
    { href: "/account/payments", label: t.account.menuPayments, icon: CardIcon },
  ];
  return (
    <>
      {/* Who: the picture on the brand's tint, the name under it, and the
          address in the small line. */}
      <div className="acct-pop-head">
        {user.avatarUrl ? (
          <Avatar url={user.avatarUrl} size={48} />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-pill bg-brand-solid text-base font-extrabold text-brand-on-solid">
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink-900">{user.name || user.email}</p>
          <p className="truncate text-xs text-ink-500">{user.email}</p>
        </div>
      </div>
      <ul className="p-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="acct-pop-row">
              <span className="acct-pop-icon">
                <link.icon size={16} />
              </span>
              <span className="min-w-0 flex-1 leading-snug">{link.label}</span>
              <ChevronRightIcon size={14} className="shrink-0 text-ink-300" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-line p-1.5">
        <form action={logout}>
          <button type="submit" className="acct-pop-row is-out">
            <span className="acct-pop-icon">
              <LogoutIcon size={16} />
            </span>
            {t.auth.signOut}
          </button>
        </form>
      </div>
    </>
  );
}
