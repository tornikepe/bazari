"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { BagIcon, CardIcon, SettingsIcon } from "@/components/ui/icons";

/**
 * The account's three pages, as a row of tabs under the identity card:
 * the overview with the orders, the settings, and the payment page. The
 * current one is marked for a screen reader as well as by colour.
 */
export function AccountNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const tabs = [
    { href: "/account", label: t.account.overview, icon: BagIcon },
    {
      href: "/account/settings",
      label: t.account.settings,
      icon: SettingsIcon,
    },
    { href: "/account/payments", label: t.account.payments, icon: CardIcon },
  ];

  return (
    <nav
      aria-label={t.account.title}
      className="mt-4 flex gap-1.5 overflow-x-auto no-scrollbar"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 shrink-0 items-center gap-2 rounded-control px-3.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-panel text-panel-fg"
                : "border border-line bg-surface text-ink-600 hover:bg-ink-50 hover:text-ink-900"
            }`}
          >
            <tab.icon
              size={16}
              className={active ? "text-panel-muted" : "text-ink-400"}
            />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
