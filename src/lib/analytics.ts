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
export async function getDashboardMetrics(days: RangeDays = DEFAULT_RANGE) {
  const now = new Date();

  // The start of the *shop* day the window opens on, not UTC midnight. See
  // `shopDayStart` — the two are four hours apart, and the gap is enough for
  // the revenue figure and the sum of the bars beside it to disagree.
  const since = shopDayStart(new Date(now.getTime() - (days - 1) * DAY_MS));
  // The window before this one, the same length, for "up 12% on the last
  // thirty days" — a figure with nothing beside it is a figure, not a reading.
  const before = shopDayStart(new Date(since.getTime() - days * DAY_MS));

  // Fetched once with its items rather than re-aggregated per statistic; both
  // windows in one query, split afterwards.
  const all = await prisma.order.findMany({
    where: { status: { not: "cancelled" }, createdAt: { gte: before } },
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
  // 30 days and wasteful at 90.
  const byDay = new Map<string, number>();
  for (const order of orders) {
    const key = shopDayKey(order.createdAt);
    byDay.set(key, (byDay.get(key) ?? 0) + order.total);
  }

  // One bucket per day, so quiet days render as a baseline tick instead of
  // being skipped and distorting the shape of the chart.
  // Each key is derived from a real instant counted back from now, rather
  // than by adding 24h repeatedly to the window's start — the same reason the
  // boundary is computed rather than assumed.
  const daily = Array.from({ length: days }, (_, index) => {
    const key = shopDayKey(new Date(now.getTime() - (days - 1 - index) * DAY_MS));
    return { date: key, total: byDay.get(key) ?? 0 };
  });

  // Units per day too, for the small line beside that figure.
  const unitsByDay = new Map<string, number>();
  for (const order of orders) {
    const key = shopDayKey(order.createdAt);
    const count = order.items.reduce((n, item) => n + item.quantity, 0);
    unitsByDay.set(key, (unitsByDay.get(key) ?? 0) + count);
  }

  return {
    days,
    revenue,
    profit,
    units,
    orderCount: orders.length,
    avgOrder: orders.length ? revenue / orders.length : 0,
    marginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    daily,
    dailyUnits: daily.map((day) => unitsByDay.get(day.date) ?? 0),
    /** The same figures for the window before this one. */
    previous,
  };
}
