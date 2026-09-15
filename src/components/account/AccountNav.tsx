"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { BagIcon, CardIcon, SettingsIcon } from "@/components/ui/icons";

/**
 * The account's three pages, as a row of tabs along the foot of the
 * identity card: the overview with the orders, the settings, and the
 * payment page. The current one is underlined, and marked for a screen
 * reader as well as by colour.
 *
 * Three equal cells on a phone, where a row of pills was one and a half
 * pills wide and the third scrolled out of sight; from `sm` up the tabs
 * take their own width and sit to the left. The icons go on a phone too —
 * "პარამეტრები" with an icon beside it does not fit a third of 375px.
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
      className="grid grid-cols-3 border-t border-line px-1 sm:flex sm:px-2"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-12 min-w-0 items-center justify-center gap-2 px-1 text-[13px] font-semibold transition-colors sm:px-3.5 sm:text-sm ${
              active ? "text-ink-900" : "text-ink-500 hover:text-ink-900"
            }`}
          >
            <tab.icon
              size={16}
              className={`hidden shrink-0 sm:block ${active ? "text-brand-600" : "text-ink-400"}`}
            />
            <span className="truncate">{tab.label}</span>
            {/* The underline: inset from the tab's edges so two neighbours
                never read as one bar, and drawn only under the current page
                rather than faded under the rest. */}
            {active && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-600 sm:inset-x-3"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
