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
      /* Words with a rule under the chosen one, not a row of filled
         lozenges each with a disc of its own behind the count: five
         pills side by side read as five buttons competing, and the one
         thing the row has to say is which of the five you are looking
         at. A status this account has never reached is still shown —
         the row is the journey an order takes — but greyed and dead. */
      className={`order-tabs ${isPending ? "is-busy" : ""}`}
    >
      {options.map(({ value, count }) => {
        const active = current === value;
        return (
          <button
            key={value ?? "all"}
            type="button"
            disabled={count === 0}
            onClick={() => choose(value)}
            aria-pressed={active}
            className={`order-tab ${active ? "is-on" : ""}`}
          >
            <span>{value ? t.status[value] : t.account.orderFilterAll}</span>
            <span className="order-tab-count">{count}</span>
          </button>
        );
      })}
    </nav>
  );
}
