import "server-only";

import { prisma } from "@/lib/prisma";
import { shopDayKey, shopDayStart } from "@/lib/format";
import type { RangeDays } from "@/lib/analytics";

/**
 * The funnel, per product and per category, over a trailing window.
 *
 * Six questions the owner asked of every product: how many saw it, how
 * many opened it, how many put it in the cart, how many bought it, what a
 * customer cost to bring, and what was left as profit. The first three are
 * counts kept without a cookie — page views by path, and the click / cart
 * / track beacons in `ProductEvent`. The sales are the orders themselves,
 * cancelled ones left out. The money the shop spent bringing people in is
 * the one figure nothing here can count: it is typed in per month on the
 * same page, and shared across the days of the window in proportion.
 *
 * "Profit" on a row is the margin on what was sold — price less the cost
 * price snapshotted on each line. The net figure at the top takes the
 * window's marketing spend off the sum of those margins.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type FunnelRow = {
  id: string;
  name: { ka: string; en: string };
  /** The product's, for a link; a category row has none. */
  slug?: string;
  categoryId?: string;
  views: number;
  clicks: number;
  carts: number;
  /** Distinct orders holding the product. */
  orders: number;
  units: number;
  /** Tetri. */
  revenue: number;
  cost: number;
  profit: number;
  /** The order's page looked at afterwards. */
  tracks: number;
};

export type ProductAnalytics = {
  days: RangeDays;
  products: FunnelRow[];
  categories: FunnelRow[];
  totals: Omit<FunnelRow, "id" | "name">;
  /** Tetri, the window's share of the months it touches. */
  spend: number;
  /** Customers whose first order fell in the window. */
  newCustomers: number;
  /** Tetri per new customer; null when there were none to divide by. */
  cac: number | null;
  /** Margin less spend. */
  netProfit: number;
  /** The months the window touches, with what was typed in for each. */
  months: { month: string; amount: number }[];
};

function emptyRow(): Omit<FunnelRow, "id" | "name"> {
  return { views: 0, clicks: 0, carts: 0, orders: 0, units: 0, revenue: 0, cost: 0, profit: 0, tracks: 0 };
}

/** `YYYY-MM` of a shop-day key. */
const monthOf = (day: string) => day.slice(0, 7);

const daysInMonth = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  return new Date(Date.UTC(year!, index!, 0)).getUTCDate();
};

export async function getProductAnalytics(days: RangeDays): Promise<ProductAnalytics> {
  const now = new Date();
  const keys = Array.from({ length: days }, (_, index) =>
    shopDayKey(new Date(now.getTime() - (days - 1 - index) * DAY_MS)),
  );
  const sinceKey = keys[0]!;
  const since = shopDayStart(new Date(now.getTime() - (days - 1) * DAY_MS));

  const [products, categories, views, events, lines, firstOrders, spendRows] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, slug: true, nameKa: true, nameEn: true, categoryId: true },
    }),
    prisma.category.findMany({ select: { id: true, nameKa: true, nameEn: true }, orderBy: { sortOrder: "asc" } }),
    prisma.pageView.groupBy({
      by: ["path"],
      where: { day: { gte: sinceKey }, path: { startsWith: "/product/" } },
      _sum: { views: true },
    }),
    prisma.productEvent.groupBy({
      by: ["productId", "kind"],
      where: { day: { gte: sinceKey } },
      _sum: { count: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: since }, status: { not: "cancelled" } }, productId: { not: null } },
      select: { productId: true, orderId: true, price: true, costPrice: true, quantity: true },
    }),
    // Every customer's first order, by phone — every order has one, and a
    // guest has no account. Counted new when that first order is in the window.
    prisma.order.groupBy({
      by: ["phone"],
      where: { status: { not: "cancelled" } },
      _min: { createdAt: true },
    }),
    prisma.marketingSpend.findMany({
      where: { month: { in: [...new Set(keys.map(monthOf))] } },
    }),
  ]);

  const rows = new Map<string, FunnelRow>(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        name: { ka: product.nameKa, en: product.nameEn },
        slug: product.slug,
        categoryId: product.categoryId,
        ...emptyRow(),
      },
    ]),
  );
  const bySlug = new Map(products.map((product) => [product.slug, product.id]));

  for (const view of views) {
    const id = bySlug.get(view.path.slice("/product/".length));
    const row = id ? rows.get(id) : undefined;
    if (row) row.views += view._sum.views ?? 0;
  }
  for (const event of events) {
    const row = rows.get(event.productId);
    if (!row) continue;
    const count = event._sum.count ?? 0;
    if (event.kind === "click") row.clicks += count;
    else if (event.kind === "cart") row.carts += count;
    else if (event.kind === "track") row.tracks += count;
  }
  const ordersPer = new Map<string, Set<string>>();
  for (const line of lines) {
    const row = rows.get(line.productId!);
    if (!row) continue;
    row.units += line.quantity;
    row.revenue += line.price * line.quantity;
    row.cost += line.costPrice * line.quantity;
    let set = ordersPer.get(row.id);
    if (!set) ordersPer.set(row.id, (set = new Set()));
    set.add(line.orderId);
  }
  for (const row of rows.values()) {
    row.orders = ordersPer.get(row.id)?.size ?? 0;
    row.profit = row.revenue - row.cost;
  }

  // Categories: the sum of their products.
  const categoryRows = new Map<string, FunnelRow>(
    categories.map((category) => [
      category.id,
      { id: category.id, name: { ka: category.nameKa, en: category.nameEn }, ...emptyRow() },
    ]),
  );
  const totals = emptyRow();
  for (const row of rows.values()) {
    const targets = [totals, row.categoryId ? categoryRows.get(row.categoryId) : undefined];
    for (const target of targets) {
      if (!target) continue;
      target.views += row.views;
      target.clicks += row.clicks;
      target.carts += row.carts;
      target.orders += row.orders;
      target.units += row.units;
      target.revenue += row.revenue;
      target.cost += row.cost;
      target.profit += row.profit;
      target.tracks += row.tracks;
    }
  }

  // The window's share of each month it touches: a month's figure spread
  // evenly over its days, and the days inside the window summed.
  const daysPerMonth = new Map<string, number>();
  for (const key of keys) daysPerMonth.set(monthOf(key), (daysPerMonth.get(monthOf(key)) ?? 0) + 1);
  const spendByMonth = new Map(spendRows.map((row) => [row.month, row.amount]));
  let spend = 0;
  const months = [...daysPerMonth.keys()].sort().map((month) => {
    const amount = spendByMonth.get(month) ?? 0;
    spend += Math.round((amount * daysPerMonth.get(month)!) / daysInMonth(month));
    return { month, amount };
  });

  const newCustomers = firstOrders.filter(
    (row) => row._min.createdAt !== null && row._min.createdAt >= since,
  ).length;

  const byRevenue = (a: FunnelRow, b: FunnelRow) => b.revenue - a.revenue || b.views - a.views;

  return {
    days,
    products: [...rows.values()].sort(byRevenue),
    categories: [...categoryRows.values()].sort(byRevenue),
    totals,
    spend,
    newCustomers,
    cac: newCustomers > 0 ? Math.round(spend / newCustomers) : null,
    netProfit: totals.profit - spend,
    months,
  };
}
