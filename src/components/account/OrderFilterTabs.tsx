"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import type { OrderStatus } from "@/lib/order-status";

/**
 * Which orders the list shows: all of them, or one status.
 *
 * The filter is still part of the address — `?status=delivered` can be
 * bookmarked and the back button behaves — but it changes the address
 * without moving the page. As links, every press went through a full
 * navigation and landed at the top, so a customer three screens down
 * choosing "delivered" was put back at their own name and had to scroll
 * to the list again. The push here asks the router not to scroll, and
 * the list dims while the new rows arrive.
 */
export function OrderFilterTabs({
  current,
  options,
}: {
  current: OrderStatus | null;
  /** The statuses this account has reached, with how many of each. */
  options: { value: OrderStatus | null; count: number }[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const choose = (value: OrderStatus | null) => {
    if (value === current) return;
    startTransition(() => {
      router.push(value ? `/account/orders?status=${value}` : "/account/orders", { scroll: false });
    });
  };

  return (
    <nav
      aria-label={t.account.orderFilter}
      aria-busy={isPending}
      /* The strip scrolls inside its own box on a phone, where six pills
         do not fit; the card around it hides its overflow and cannot. */
      className={`flex gap-1.5 overflow-x-auto border-b border-line px-4 py-3 no-scrollbar transition-opacity sm:flex-wrap sm:justify-center sm:px-5 ${
        isPending ? "opacity-60" : ""
      }`}
    >
      {options.map(({ value, count }) => {
        const active = current === value;
        return (
          <button
            key={value ?? "all"}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={active}
            className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-sm transition-colors ${
              active
                ? "bg-panel font-semibold text-panel-fg"
                : "border border-line text-ink-600 hover:bg-ink-50"
            }`}
          >
            {value ? t.status[value] : t.account.orderFilterAll}
            <span className={active ? "text-panel-muted" : "text-ink-400"}>{count}</span>
          </button>
        );
      })}
    </nav>
  );
}
