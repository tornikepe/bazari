"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { BagIcon, CardIcon, SettingsIcon } from "@/components/ui/icons";

/**
 * The account's three pages, as a row of pills along the foot of the
 * identity card: the overview with the orders, the settings, and the
 * payment page. The current one is filled, and marked for a screen
 * reader as well as by colour.
 *
 * Three equal cells on a phone, where a row of pills was one and a half
 * pills wide and the third scrolled out of sight; from `sm` up the pills
 * take their own width. The icons go on a phone too — "პარამეტრები"
 * with an icon beside it does not fit a third of 375px.
 */
export function AccountNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const tabs = [
    { href: "/account", label: t.account.overview, icon: BagIcon },
    { href: "/account/settings", label: t.account.settings, icon: SettingsIcon },
    { href: "/account/payments", label: t.account.payments, icon: CardIcon },
  ];

  return (
    <nav aria-label={t.account.title} className="border-t border-line px-3 py-3 sm:px-5">
      <div className="grid grid-cols-3 gap-1 rounded-control bg-ink-50 p-1 sm:inline-grid sm:auto-cols-max sm:grid-flow-col">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-[calc(var(--radius-control)-2px)] px-2 text-[13px] font-semibold transition-colors sm:px-4 sm:text-sm ${
                active
                  ? "bg-surface text-ink-900 shadow-sm"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              <tab.icon
                size={16}
                className={`hidden shrink-0 sm:block ${active ? "text-brand-600" : "text-ink-400"}`}
              />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
