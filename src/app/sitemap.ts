import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { ON_SALE } from "@/lib/catalog";

// Generated per request rather than at build time: products change from the
// admin panel, and a build shouldn't need a reachable database.
export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "",
  "/catalog",
  "/about",
  "/contact",
  "/faq",
  "/shipping",
  "/returns",
  "/warranty",
  "/terms",
  "/privacy",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: ON_SALE,
      select: { slug: true, updatedAt: true },
    }),
    // A hidden shelf is not a page to send a crawler to.
    prisma.category.findMany({ where: { isVisible: true }, select: { slug: true } }),
  ]);

  return [
    ...STATIC_PATHS.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...categories.map((category) => ({
      url: `${SITE_URL}/catalog?category=${category.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${SITE_URL}/product/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
