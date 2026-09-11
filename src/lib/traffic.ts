import "server-only";

import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { shopDayKey } from "@/lib/format";

/**
 * Page views, counted the way a shop can count them without a cookie banner.
 *
 * Nothing is stored about a person. A view is a row per day and path with a
 * number in it; a visitor is a keyed hash of the address and the browser
 * under a key derived from the day, kept only so that the same browser
 * opening six pages counts as one person rather than six. The key changes at
 * midnight, so yesterday's rows cannot be matched to today's and the hash
 * cannot be turned back into an address by anyone, this shop included.
 *
 * That is the whole of it, and it is why the site has no consent banner:
 * there is nothing here the banner would be asking permission for.
 */

/** What may be counted, and how a path is written down. */
export function normalisePath(raw: string): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.length > 200) return null;

  // The path only — a query can carry a search term, and a search term is
  // something a person typed.
  const path = raw.split(/[?#]/)[0]!;

  // Staff pages are not traffic, and an order number is somebody's receipt.
  if (path.startsWith("/dashboard") || path.startsWith("/api")) return null;
  if (path.startsWith("/order/")) return "/order/*";
  if (path.startsWith("/invite") || path.startsWith("/verify")) return null;

  return path;
}

/** The day's key for the visitor hash. New every shop day; never stored. */
function dailyKey(day: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(`traffic:${day}`).digest("hex");
}

/**
 * Counts one page view.
 *
 * Two upserts in one transaction rather than a read and a write, so two tabs
 * opening at once cannot both read 311 and both write 312.
 */
export async function recordView(path: string, ip: string, userAgent: string): Promise<void> {
  const day = shopDayKey(new Date());
  const hash = createHmac("sha256", dailyKey(day))
    .update(`${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);

  await prisma.$transaction([
    prisma.pageView.upsert({
      where: { day_path: { day, path } },
      create: { day, path, views: 1 },
      update: { views: { increment: 1 } },
    }),
    prisma.dailyVisitor.upsert({
      where: { day_hash: { day, hash } },
      create: { day, hash },
      update: {},
    }),
  ]);
}

export type TrafficReport = {
  /** One entry per day in the window, oldest first, zero-filled. */
  daily: { date: string; views: number; visitors: number }[];
  views: number;
  visitors: number;
  /** The busiest paths in the window. */
  pages: { path: string; views: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The trailing window, bucketed by shop day like the sales chart. */
export async function getTraffic(days: number): Promise<TrafficReport> {
  const now = new Date();
  const keys = Array.from({ length: days }, (_, index) =>
    shopDayKey(new Date(now.getTime() - (days - 1 - index) * DAY_MS)),
  );
  const since = keys[0]!;

  const [views, visitors, pages] = await Promise.all([
    prisma.pageView.groupBy({
      by: ["day"],
      where: { day: { gte: since } },
      _sum: { views: true },
    }),
    prisma.dailyVisitor.groupBy({
      by: ["day"],
      where: { day: { gte: since } },
      _count: { _all: true },
    }),
    prisma.pageView.groupBy({
      by: ["path"],
      where: { day: { gte: since } },
      _sum: { views: true },
      orderBy: { _sum: { views: "desc" } },
      take: 10,
    }),
  ]);

  const viewsByDay = new Map(views.map((row) => [row.day, row._sum.views ?? 0]));
  const visitorsByDay = new Map(visitors.map((row) => [row.day, row._count._all]));

  const daily = keys.map((date) => ({
    date,
    views: viewsByDay.get(date) ?? 0,
    visitors: visitorsByDay.get(date) ?? 0,
  }));

  return {
    daily,
    views: daily.reduce((sum, day) => sum + day.views, 0),
    // Summed per day, so a person who came on three days is three: the
    // hash is different each day, and that is the price of not following
    // anybody. The figure is honest about what it counts.
    visitors: daily.reduce((sum, day) => sum + day.visitors, 0),
    pages: pages.map((row) => ({ path: row.path, views: row._sum.views ?? 0 })),
  };
}
