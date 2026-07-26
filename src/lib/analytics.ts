import "server-only";

import { prisma } from "@/lib/prisma";

export const WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dashboard figures for the trailing 30 days.
 *
 * Lives outside the page component on purpose: reading the clock is impure, so
 * doing it during a component's render trips React's purity rule. Here it's an
 * ordinary async data-loader, called once per request.
 */
export async function getDashboardMetrics() {
  const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS);

  // Fetched once with its items rather than re-aggregated per statistic.
  const orders = await prisma.order.findMany({
    where: { status: { not: "cancelled" }, createdAt: { gte: since } },
    select: {
      total: true,
      createdAt: true,
      items: { select: { price: true, costPrice: true, quantity: true } },
    },
  });

  const revenue = orders.reduce((sum, order) => sum + order.total, 0);

  // Uses the cost snapshotted on each line, so past margins stay correct even
  // after a product's cost price is edited.
  const profit = orders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce((line, item) => line + (item.price - item.costPrice) * item.quantity, 0),
    0,
  );

  const units = orders.reduce(
    (sum, order) => sum + order.items.reduce((n, item) => n + item.quantity, 0),
    0,
  );

  // One bucket per day, so quiet days render as a baseline tick instead of
  // being skipped and distorting the shape of the chart.
  const daily = Array.from({ length: WINDOW_DAYS }, (_, index) => {
    const key = new Date(since.getTime() + index * DAY_MS).toISOString().slice(0, 10);
    const total = orders
      .filter((order) => order.createdAt.toISOString().slice(0, 10) === key)
      .reduce((sum, order) => sum + order.total, 0);
    return { date: key, total };
  });

  return {
    revenue,
    profit,
    units,
    orderCount: orders.length,
    avgOrder: orders.length ? revenue / orders.length : 0,
    marginPct: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    daily,
  };
}
