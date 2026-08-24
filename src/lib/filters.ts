/**
 * Catalog filter state: parsing from and serialising back to the URL.
 *
 * Deliberately free of `server-only` and Prisma imports — the sidebar is a
 * Client Component and needs `buildQuery` to construct links, while the
 * catalog page needs `parseFilters` on the server. Both share this module.
 */

export const PAGE_SIZE = 12;

/**
 * `relevance` is first because it is the default *when there is a query*, and
 * meaningless without one — a catalogue with nothing to match is not more or
 * less relevant, it is just a catalogue. `parseFilters` falls back to `newest`
 * when it is asked for on an unsearched page.
 */
export const SORT_OPTIONS = ["relevance", "newest", "price-asc", "price-desc", "name"] as const;
export type Sort = (typeof SORT_OPTIONS)[number];

export type CatalogFilters = {
  q: string;
  category: string;
  brands: string[];
  minPrice: number | null;
  maxPrice: number | null;
  inStock: boolean;
  onSale: boolean;
  sort: Sort;
  page: number;
};

/** Next.js hands search params through as `string | string[] | undefined`. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** `?brand=anker&brand=baseus` and `?brand=anker,baseus` both work. */
function many(value: string | string[] | undefined) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(
      list
        .flatMap((entry) => entry.split(","))
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return value !== "" && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseFilters(params: RawSearchParams): CatalogFilters {
  const sortParam = one(params.sort) as Sort;
  const page = Number(one(params.page));

  let minPrice = positiveNumber(one(params.min));
  let maxPrice = positiveNumber(one(params.max));
  // A reversed range returns nothing, which reads as a bug rather than a typo.
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const q = one(params.q);

  /* Relevance is the default while there is something to be relevant to, and
     is not offered at all otherwise — "sorted by how well it matches nothing"
     is a heading with no meaning behind it. A `?sort=relevance` left in a
     bookmarked URL after the query was cleared falls back rather than showing
     an arbitrary order under a confident label. */
  const fallback: Sort = q ? "relevance" : "newest";
  const asked = SORT_OPTIONS.includes(sortParam) ? sortParam : fallback;

  return {
    q,
    category: one(params.category),
    brands: many(params.brand),
    minPrice,
    maxPrice,
    inStock: one(params.stock) === "1",
    onSale: one(params.sale) === "1",
    sort: asked === "relevance" && !q ? "newest" : asked,
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

export const EMPTY_FILTERS: CatalogFilters = {
  q: "",
  category: "",
  brands: [],
  minPrice: null,
  maxPrice: null,
  inStock: false,
  onSale: false,
  sort: "newest",
  page: 1,
};

/** True when anything beyond sort/paging is narrowing the result set. */
export function hasActiveFilters(filters: CatalogFilters) {
  return Boolean(
    filters.q ||
      filters.category ||
      filters.brands.length ||
      filters.minPrice !== null ||
      filters.maxPrice !== null ||
      filters.inStock ||
      filters.onSale,
  );
}

export function countActiveFilters(filters: CatalogFilters) {
  return (
    (filters.category ? 1 : 0) +
    filters.brands.length +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    (filters.inStock ? 1 : 0) +
    (filters.onSale ? 1 : 0)
  );
}

/**
 * Serialises filters into a `/catalog?…` query string. Defaults are omitted so
 * URLs stay short and shareable.
 *
 * Paging resets to 1 on any change unless `page` is explicitly overridden —
 * otherwise narrowing the results while on page 4 lands on an empty grid.
 */
export function buildQuery(
  filters: CatalogFilters,
  overrides: Partial<CatalogFilters> = {},
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  for (const brand of next.brands) params.append("brand", brand);
  if (next.minPrice !== null) params.set("min", String(next.minPrice));
  if (next.maxPrice !== null) params.set("max", String(next.maxPrice));
  if (next.inStock) params.set("stock", "1");
  if (next.onSale) params.set("sale", "1");
  /* The default is not written into the URL, and which one is the default
     depends on whether there is a query. */
  if (next.sort !== (next.q ? "relevance" : "newest")) params.set("sort", next.sort);

  const page = "page" in overrides ? overrides.page : 1;
  if (page && page > 1) params.set("page", String(page));

  const query = params.toString();
  return query ? `?${query}` : "";
}
