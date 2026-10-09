import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE, type CatalogFilters, type Sort } from "@/lib/filters";
import { matchingProductIds } from "@/lib/search";

/**
 * What the shop will sell: a product that is switched on, on a shelf the
 * shop is showing.
 *
 * Hiding a category takes its goods off the floor. That is a decision about
 * what hiding *means*, and it was made the other way first — hidden shelf,
 * goods still on sale through a direct link — which left a shopper able to
 * buy from a shelf the owner had put away, and a basket counting things the
 * shop no longer offers. It means the same thing everywhere now: the
 * catalogue, the search, the home page, the assistant, the sitemap, what a
 * basket is allowed to hold, and what checkout will take money for.
 *
 * The product's own page is the one exception, and deliberately: somebody
 * holding the address still gets the page, with nothing in stock on it.
 */
export const ON_SALE = {
  isActive: true,
  category: { isVisible: true },
} as const satisfies Prisma.ProductWhereInput;

/**
 * The search, as a filter the rest of the query can be built on.
 *
 * `matchingProductIds` answers *which products and in what order*; everything
 * after that — category, brand, price, stock, paging — stays Prisma's. So the
 * ranked ids arrive here as a plain `IN`, and their order is carried
 * separately by whoever wants the relevance sort.
 *
 * An empty list is not the same as no search. A query that matched nothing
 * must produce no results, and `{ id: { in: [] } }` says exactly that.
 */
function buildWhere(
  filters: CatalogFilters,
  matched: string[] | null,
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [ON_SALE];

  if (matched !== null) and.push({ id: { in: matched } });

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
    case "recommended":
      /* What the shop put forward first, then what customers have rated,
         then the newest — the order a shop assistant would show things in. */
      return [{ isFeatured: "desc" }, { ratingSum: "desc" }, { createdAt: "desc" }, { id: "asc" }];
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
  // Two integers, so a card can print a star without a query of its own.
  ratingSum: true,
  ratingCount: true,
  // Whether the product is sold in more than one form. A card cannot add
  // such a product — there is no "this product" in a cart, only a size —
  // so it sends the shopper to the page where the choice is made.
  _count: { select: { options: true } },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export async function getFilteredProducts(filters: CatalogFilters) {
  const matched = filters.q ? await matchingProductIds(filters.q) : null;
  const where = buildWhere(filters, matched);

  const total = await prisma.product.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp so a stale `?page=99` shows the last page instead of an empty grid.
  const page = Math.min(filters.page, pageCount);

  /* Relevance is not a column, so it cannot be an `ORDER BY`. When it is the
     sort, the filtered ids are read first, put back into the order the search
     gave them, and only then paged — two queries where one would do, which at
     this scale costs a few milliseconds and buys the one ordering a search
     result actually wants. */
  if (matched && filters.sort === "relevance") {
    const ids = await prisma.product.findMany({ where, select: { id: true } });
    const present = new Set(ids.map((row) => row.id));
    const ordered = matched.filter((id) => present.has(id));
    const slice = ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const rows = await prisma.product.findMany({
      where: { id: { in: slice } },
      select: productCardSelect,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));

    return {
      items: slice.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
      total,
      page,
      pageCount,
    };
  }

  const items = await prisma.product.findMany({
    where,
    select: productCardSelect,
    orderBy: buildOrderBy(filters.sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return { items, total, page, pageCount };
}

/**
 * The shelves a shopper may be offered, with what is on each.
 *
 * Hidden ones are left out here and everywhere else the storefront lists
 * them. A hidden shelf's products are not withdrawn — they stay in the
 * catalogue and answer to a direct address — so this filters the list of
 * places to go, not the goods.
 */
export function getCategoriesWithCounts() {
  return prisma.category.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
    include: {
      _count: { select: { products: { where: ON_SALE } } },
    },
  });
}

/**
 * One category by its address, listed or not.
 *
 * The filter rail offers only the listed ones, but somebody can arrive at
 * `/catalog?category=…` for a hidden shelf — from a bookmark, a shared link,
 * or the shop's own `?category=` written before it was hidden. Without this
 * the page knew it was filtered and could not name the filter: no heading,
 * and no chip to take it off with.
 */
export function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    select: { slug: true, nameKa: true, nameEn: true, icon: true },
  });
}

/**
 * Brands available under the *other* active filters, alphabetical.
 *
 * The brand facet itself is excluded from the scope — otherwise picking one
 * brand would hide every other checkbox and make multi-select impossible.
 */
export async function getBrands(filters: CatalogFilters) {
  const matched = filters.q ? await matchingProductIds(filters.q) : null;
  const where = buildWhere({ ...filters, brands: [] }, matched);

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
    where: ON_SALE,
    _min: { price: true },
    _max: { price: true },
  });

  return {
    // Handed to the filter inputs, which work in lari like the URL does.
    min: Math.floor((result._min.price ?? 0) / 100),
    max: Math.ceil((result._max.price ?? 100_000) / 100),
  };
}
