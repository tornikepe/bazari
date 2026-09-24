import "server-only";

import { prisma } from "@/lib/prisma";
import { shopDayStart } from "@/lib/format";

/** The windows the cost-and-profit page offers for what has already sold. */
export const MARGIN_RANGES = [30, 90, 365, 0] as const;
export type MarginRange = (typeof MARGIN_RANGES)[number];

/** `0` means "everything the shop has ever sold". */
export const DEFAULT_MARGIN_RANGE: MarginRange = 30;

export function isMarginRange(value: number): value is MarginRange {
  return (MARGIN_RANGES as readonly number[]).includes(value);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** One product, with what it cost, what it sells for and what is left. */
export type MarginRow = {
  id: string;
  slug: string;
  nameKa: string;
  nameEn: string;
  sku: string;
  image: string;
  isActive: boolean;
  /** Tetri, as everything is stored. */
  cost: number;
  price: number;
  stock: number;
  /** `price - cost`, per unit. */
  unit: number;
  /** The share of the price that is margin, rounded to a whole percent. */
  percent: number;
  /** What the pieces on the shelf cost to buy, and what they will fetch. */
  stockCost: number;
  stockRetail: number;
  /** `stockRetail - stockCost`: the profit still sitting in the stockroom. */
  expected: number;
  /** Units sold in the window, and what they left behind. */
  sold: number;
  earned: number;
};

export type MarginReport = {
  rows: MarginRow[];
  totals: {
    /** Across every product, whether it is on the shelf or not. */
    products: number;
    /** Products with no buying price typed in yet — the figures below are short by whatever they cost. */
    withoutCost: number;
    units: number;
    stockCost: number;
    stockRetail: number;
    expected: number;
    /** The window's sales, at what they sold for and what they had cost. */
    revenue: number;
    soldCost: number;
    earned: number;
    /** What share of the takings stayed, as a whole percent. */
    earnedPercent: number;
  };
};

/**
 * What the shop paid, what it will take, and what is left over — both
 * halves of it.
 *
 * Two different questions share this page, and they are different in kind.
 * What is *still* to be made is arithmetic on the stockroom: every piece on
 * the shelf, what it cost and what it is priced at. What has *already* been
 * made is the orders: each line carries the buying price as it stood on the
 * day it was sold, so repricing a product tomorrow does not rewrite what
 * last month earned.
 *
 * Cancelled orders are left out of both. Everything is in tetri.
 */
export async function getMarginReport(range: MarginRange = DEFAULT_MARGIN_RANGE): Promise<MarginReport> {
  const since = range > 0 ? shopDayStart(new Date(Date.now() - (range - 1) * DAY_MS)) : null;

  const [products, sales] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ nameKa: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        nameKa: true,
        nameEn: true,
        sku: true,
        image: true,
        isActive: true,
        price: true,
        costPrice: true,
        stock: true,
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: { not: "cancelled" },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
      },
      select: { productId: true, price: true, costPrice: true, quantity: true },
    }),
  ]);

  /* What each product sold, keyed by its id. A line whose product has since
     been deleted keeps its money in the totals and loses its row, which is
     the honest reading: the shop earned it, and there is nothing left to
     show it against. */
  const sold = new Map<string, { units: number; revenue: number; cost: number }>();
  let revenue = 0;
  let soldCost = 0;

  for (const line of sales) {
    revenue += line.price * line.quantity;
    soldCost += line.costPrice * line.quantity;
    if (!line.productId) continue;
    const row = sold.get(line.productId) ?? { units: 0, revenue: 0, cost: 0 };
    row.units += line.quantity;
    row.revenue += line.price * line.quantity;
    row.cost += line.costPrice * line.quantity;
    sold.set(line.productId, row);
  }

  const rows: MarginRow[] = products.map((product) => {
    const stock = Math.max(0, product.stock);
    const unit = product.price - product.costPrice;
    const line = sold.get(product.id);

    return {
      id: product.id,
      slug: product.slug,
      nameKa: product.nameKa,
      nameEn: product.nameEn,
      sku: product.sku,
      image: product.image,
      isActive: product.isActive,
      cost: product.costPrice,
      price: product.price,
      stock,
      unit,
      percent: product.price > 0 ? Math.round((unit / product.price) * 100) : 0,
      stockCost: product.costPrice * stock,
      stockRetail: product.price * stock,
      expected: unit * stock,
      sold: line?.units ?? 0,
      earned: line ? line.revenue - line.cost : 0,
    };
  });

  const stockCost = rows.reduce((sum, row) => sum + row.stockCost, 0);
  const stockRetail = rows.reduce((sum, row) => sum + row.stockRetail, 0);
  const earned = revenue - soldCost;

  return {
    rows,
    totals: {
      products: rows.length,
      withoutCost: rows.filter((row) => row.cost === 0).length,
      units: rows.reduce((sum, row) => sum + row.stock, 0),
      stockCost,
      stockRetail,
      expected: stockRetail - stockCost,
      revenue,
      soldCost,
      earned,
      earnedPercent: revenue > 0 ? Math.round((earned / revenue) * 100) : 0,
    },
  };
}
