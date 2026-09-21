"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { logout } from "@/app/actions/auth";
import { initialsOf } from "@/components/account/initials";
import type { SessionUser } from "@/lib/auth";
import {
  CardIcon,
  ClockIcon,
  LogoutIcon,
  MapPinIcon,
  UserIcon,
} from "@/components/ui/icons";

/**
 * The account's menu: the customer at the top, then one row per page —
 * the account itself, the addresses, the orders with their returns, the
 * wishlist, the payment settings — and sign-out last in the brand's
 * colour. The current page's row is filled.
 */
export function AccountMenu({ user, signOutLabel }: { user: SessionUser; signOutLabel: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: "/account", label: t.account.menuProfile, icon: UserIcon },
    { href: "/account/addresses", label: t.account.menuAddresses, icon: MapPinIcon },
    { href: "/account/orders", label: t.account.menuOrders, icon: ClockIcon },
    { href: "/account/payments", label: t.account.menuPayments, icon: CardIcon },
  ];

  return (
    <aside className="account-menu">
      <div className="account-menu-who">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-solid text-sm font-extrabold text-brand-on-solid"
          >
            {initialsOf(user.name, user.email)}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink-900">{user.name || user.email}</span>
          <span className="block truncate text-xs text-ink-500">{user.email}</span>
        </span>
      </div>

      <nav aria-label={t.account.title} className="account-menu-list">
        {items.map((item) => {
          const current = pathname === item.href || (item.href !== "/account" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={`account-menu-row ${current ? "is-on" : ""}`}
            >
              <item.icon size={20} className="shrink-0" />
              <span className="min-w-0">{item.label}</span>
            </Link>
          );
        })}
        <form action={logout}>
          <button type="submit" className="account-menu-row is-out">
            <LogoutIcon size={20} className="shrink-0" />
            {signOutLabel}
          </button>
        </form>
      </nav>
    </aside>
  );
}
