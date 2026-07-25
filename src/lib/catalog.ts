import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type CatalogFilters, type Sort } from "@/lib/filters";

function buildWhere(filters: CatalogFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true }];

  if (filters.q) {
    // SQLite `LIKE` is case-insensitive for ASCII, and Georgian is caseless,
    // so both locales match without Prisma's `mode` (unsupported on SQLite).
    and.push({
      OR: [
        { nameKa: { contains: filters.q } },
        { nameEn: { contains: filters.q } },
        { brand: { contains: filters.q } },
        { descriptionKa: { contains: filters.q } },
        { descriptionEn: { contains: filters.q } },
      ],
    });
  }

  if (filters.category) and.push({ category: { slug: filters.category } });
  if (filters.brands.length) and.push({ brand: { in: filters.brands } });
  if (filters.minPrice !== null) and.push({ price: { gte: filters.minPrice } });
  if (filters.maxPrice !== null) and.push({ price: { lte: filters.maxPrice } });
  if (filters.rating !== null) and.push({ rating: { gte: filters.rating } });
  if (filters.inStock) and.push({ stock: { gt: 0 } });
  if (filters.onSale) and.push({ oldPrice: { not: null } });

  return { AND: and };
}

// `id` is the tiebreaker everywhere so equal values keep a stable order across
// pages — without it, rows can repeat or vanish between page 1 and page 2.
function buildOrderBy(sort: Sort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "price-asc":
      return [{ price: "asc" }, { id: "asc" }];
    case "price-desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "rating":
      return [{ rating: "desc" }, { reviewCount: "desc" }, { id: "asc" }];
    case "popular":
      return [{ reviewCount: "desc" }, { rating: "desc" }, { id: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export const productCardSelect = {
  id: true,
  slug: true,
  nameKa: true,
  nameEn: true,
  price: true,
  oldPrice: true,
  stock: true,
  image: true,
  brand: true,
  rating: true,
  reviewCount: true,
  shippingDays: true,
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export async function getFilteredProducts(filters: CatalogFilters) {
  const where = buildWhere(filters);

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp so a stale `?page=99` shows the last page instead of an empty grid.
  const page = Math.min(filters.page, pageCount);

  const items = await prisma.product.findMany({
    where,
    select: productCardSelect,
    orderBy: buildOrderBy(filters.sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { items, total, page, pageCount };
}

export function getCategoriesWithCounts() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: {
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
}

/**
 * Brands available under the *other* active filters, alphabetical.
 *
 * The brand facet itself is excluded from the scope — otherwise picking one
 * brand would hide every other checkbox and make multi-select impossible.
 */
export async function getBrands(filters: CatalogFilters) {
  const where = buildWhere({ ...filters, brands: [] });

  const rows = await prisma.product.findMany({
    where: { AND: [where, { brand: { not: "" } }] },
    distinct: ["brand"],
    select: { brand: true },
    orderBy: { brand: "asc" },
  });

  const brands = rows.map((row) => row.brand);

  // Keep any selected brand visible even if the other facets exclude it, so
  // the checkbox that produced the current URL can still be unticked.
  for (const selected of filters.brands) {
    if (!brands.includes(selected)) brands.push(selected);
  }

  return brands.sort((a, b) => a.localeCompare(b));
}

/** Bounds for the price inputs, rounded outwards to whole units. */
export async function getPriceBounds() {
  const result = await prisma.product.aggregate({
    where: { isActive: true },
    _min: { price: true },
    _max: { price: true },
  });

  return {
    min: Math.floor(result._min.price ?? 0),
    max: Math.ceil(result._max.price ?? 1000),
  };
}
