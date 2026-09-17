import "server-only";

import { prisma } from "@/lib/prisma";
import { shopDayKey, shopDayStart } from "@/lib/format";

/** The windows the dashboard offers. */
export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

export const DEFAULT_RANGE: RangeDays = 30;

/** Kept for the callers that still describe the default window. */
export const WINDOW_DAYS = DEFAULT_RANGE;

export function isRangeDays(value: number): value is RangeDays {
  return (RANGE_DAYS as readonly number[]).includes(value);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dashboard figures for a trailing window.
 *
 * Lives outside the page component on purpose: reading the clock is impure, so
 * doing it during a component's render trips React's purity rule. Here it's an
 * ordinary async data-loader, called once per request.
 *
 * Days are bucketed by *shop* time rather than UTC. Georgia is four hours
 * ahead, so bucketing on `toISOString()` filed every order placed between
 * midnight and 04:00 in Tbilisi under the previous day — wrong on the chart,
 * and wrong in a way nobody would catch until they compared a daily total
 * against the orders list and found four hours of takings on the wrong bar.
 */
/**
 * A window of shop days, `from` and `to` inclusive as `YYYY-MM-DD` keys.
 * Either a count of trailing days or two dates the owner picked.
 */
export type MetricsWindow = RangeDays | { from: string; to: string };

/** `YYYY-MM-DD`, or null — a date that came from a query string. */
export function parseDayKey(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(Date.parse(`${value}T12:00:00Z`)) ? null : value;
}

export async function getDashboardMetrics(window: MetricsWindow = DEFAULT_RANGE) {
  const now = new Date();

  // The start of the *shop* day the window opens on, not UTC midnight. See
  // `shopDayStart` — the two are four hours apart, and the gap is enough for
  // the revenue figure and the sum of the bars beside it to disagree. Two
  // picked dates are read the same way, and a window never runs past today.
  const lastKey = typeof window === "number" ? shopDayKey(now) : window.to;
  const firstKey =
    typeof window === "number"
      ? shopDayKey(new Date(now.getTime() - (window - 1) * DAY_MS))
      : window.from;
  const noon = (key: string) => new Date(`${key}T12:00:00+04:00`);
  const days = Math.max(
    1,
    Math.round((noon(lastKey).getTime() - noon(firstKey).getTime()) / DAY_MS) + 1,
  );
  const since = shopDayStart(noon(firstKey));
  const until = shopDayStart(new Date(noon(lastKey).getTime() + DAY_MS));
  // The window before this one, the same length, for "up 12% on the last
  // thirty days" — a figure with nothing beside it is a figure, not a reading.
  const before = shopDayStart(new Date(since.getTime() - days * DAY_MS));

  // Fetched once with its items rather than re-aggregated per statistic; both
  // windows in one query, split afterwards.
  const all = await prisma.order.findMany({
    where: { status: { not: "cancelled" }, createdAt: { gte: before, lt: until } },
    select: {
      total: true,
      createdAt: true,
      items: { select: { price: true, costPrice: true, quantity: true } },
    },
  });
  const orders = all.filter((order) => order.createdAt >= since);
  const previousOrders = all.filter((order) => order.createdAt < since);

  const sumOf = (rows: typeof all) => ({
    revenue: rows.reduce((sum, order) => sum + order.total, 0),
    // Uses the cost snapshotted on each line, so past margins stay correct
    // even after a product's cost price is edited.
    profit: rows.reduce(
      (sum, order) =>
        sum +
        order.items.reduce((line, item) => line + (item.price - item.costPrice) * item.quantity, 0),
      0,
    ),
    units: rows.reduce(
      (sum, order) => sum + order.items.reduce((n, item) => n + item.quantity, 0),
      0,
    ),
    orderCount: rows.length,
  });

  const { revenue, profit, units } = sumOf(orders);
  const previous = sumOf(previousOrders);

  // Summed into a map in one pass rather than re-filtering the whole order
  // list once per bucket. That was O(days × orders), which is unremarkable at
  // 30 days and wasteful at 90. Every figure the table shows is kept per day:
  // the money, the orders, the units, the margin.
  const byDay = new Map<string, { total: number; orders: number; units: number; profit: number }>();
  for (const order of orders) {
    const key = shopDayKey(order.createdAt);
    const row = byDay.get(key) ?? { total: 0, orders: 0, units: 0, profit: 0 };
    row.total += order.total;
    row.orders += 1;
    for (const item of order.items) {
      row.units += item.quantity;
      row.profit += (item.price - item.costPrice) * item.quantity;
    }
    byDay.set(key, row);
  }

  // One bucket per day, so quiet days render as a baseline tick instead of
  // being skipped and distorting the shape of the chart.
  // Each key is derived from a real instant counted forward from the first
  // day, rather than by adding 24h to a string — the same reason the
  // boundary is computed rather than assumed.
  const daily = Array.from({ length: days }, (_, index) => {
    const key = shopDayKey(new Date(noon(firstKey).getTime() + index * DAY_MS));
    const row = byDay.get(key);
    return {
      date: key,
      total: row?.total ?? 0,
      orders: row?.orders ?? 0,
      units: row?.units ?? 0,
      profit: row?.profit ?? 0,
    };
  });

  return {
    days,
    from: firstKey,
    to: lastKey,
    revenue,
    profit,
    units,
    orderCount: orders.length,
    avgOrder: orders.length ? revenue / orders.length : 0,
    marginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    daily,
    /** The same figures for the window before this one. */
    previous,
  };
}
