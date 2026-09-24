"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { logout } from "@/app/actions/auth";
import { AvatarPicker } from "@/components/account/AvatarPicker";
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
        {/* The picture is the control: pressing it chooses a new one. */}
        <AvatarPicker name={user.name} email={user.email} avatarUrl={user.avatarUrl} />
        <span className="min-w-0">
          <span className="account-menu-name">{user.name || user.email}</span>
          <span className="account-menu-mail">{user.email}</span>
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
              <item.icon size={18} className="shrink-0" />
              <span className="min-w-0">{item.label}</span>
            </Link>
          );
        })}
        <form action={logout}>
          <button type="submit" className="account-menu-row is-out">
            <LogoutIcon size={18} className="shrink-0" />
            {signOutLabel}
          </button>
        </form>
      </nav>
    </aside>
  );
}
