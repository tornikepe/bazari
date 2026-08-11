import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type CatalogFilters, type Sort } from "@/lib/filters";

/**
 * What "matches this text" means, in one place.
 *
 * Exported because the header's suggestion endpoint needs the same answer. Two
 * copies would be two definitions, and the failure would be quiet and
 * infuriating: a product offered in the dropdown and missing from the results
 * page you land on after pressing enter.
 */
export function searchPredicate(query: string): Prisma.ProductWhereInput {
  // Postgres `LIKE` is case-sensitive, so `mode: "insensitive"` is required
  // for "anker" to match "Anker". (Georgian is caseless and unaffected.)
  const contains = { contains: query, mode: "insensitive" } as const;

  return {
    isActive: true,
    OR: [
      { nameKa: contains },
      { nameEn: contains },
      { brand: contains },
      { descriptionKa: contains },
      { descriptionEn: contains },
    ],
  };
}

function buildWhere(filters: CatalogFilters): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ isActive: true }];

  if (filters.q) and.push(searchPredicate(filters.q));

  if (filters.category) and.push({ category: { slug: filters.category } });
  if (filters.brands.length) and.push({ brand: { in: filters.brands } });
  // The URL carries lari, because `?minPrice=100` is what a person expects to
  // see and to share. Prices are stored in tetri, so convert here — this is the
  // only place the two units meet on the read path.
  if (filters.minPrice !== null) and.push({ price: { gte: filters.minPrice * 100 } });
  if (filters.maxPrice !== null) and.push({ price: { lte: filters.maxPrice * 100 } });
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
    case "name":
      return [{ nameKa: "asc" }, { id: "asc" }];
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
    // Handed to the filter inputs, which work in lari like the URL does.
    min: Math.floor((result._min.price ?? 0) / 100),
    max: Math.ceil((result._max.price ?? 100_000) / 100),
  };
}
