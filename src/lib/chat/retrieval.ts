import "server-only";

import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { getPage } from "@/lib/info-store";
import type { InfoSlug } from "@/lib/info-pages";
import { getSettings } from "@/lib/settings";
import type { ShopSettings } from "@/lib/settings-defaults";
import type { Locale } from "@/lib/i18n";

/**
 * Everything the assistant is allowed to know about the shop.
 *
 * Two halves, on purpose:
 *
 * - **Standing context** (`shopContext`) goes into the system prompt: the real
 *   category list, the real product count, the real price range, and the
 *   information pages verbatim. It changes rarely, so it is cached and byte
 *   stable — which is what lets prompt caching actually hit.
 * - **Live lookups** (`searchProducts`, `getProductBySlug`) run as tools, so a
 *   price or a stock level quoted in an answer is the one in the database at
 *   the moment of asking, not a number frozen into a prompt an hour ago.
 *
 * Every function here reads. Nothing in this module writes, and nothing takes
 * a user id — ownership-gated data lives in `order-lookup.ts`.
 */

/* ------------------------------------------------------------------ */
/* Standing context                                                    */
/* ------------------------------------------------------------------ */

/** Pages the assistant is allowed to answer from, in the order it should prefer. */
const CONTEXT_PAGES: InfoSlug[] = [
  "faq",
  "shipping",
  "returns",
  "warranty",
  "about",
  "contact",
];

type CacheEntry = { text: string; expiresAt: number };
const CONTEXT_TTL_MS = 5 * 60 * 1000;
const contextCache = new Map<Locale, CacheEntry>();

/**
 * The catalogue summary, counted from the database — never estimated.
 *
 * The user's standing rule for this project is that no number shown to anyone
 * may be invented, and that applies just as much to a number the assistant
 * repeats back. If the shop has 41 products, this says 41.
 */
async function catalogueSummary(locale: Locale): Promise<string> {
  const active = { isActive: true } as const;

  const [total, inStock, aggregate, categories, brands] = await Promise.all([
    prisma.product.count({ where: active }),
    prisma.product.count({ where: { ...active, stock: { gt: 0 } } }),
    prisma.product.aggregate({
      where: active,
      _min: { price: true },
      _max: { price: true },
    }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        nameKa: true,
        nameEn: true,
        _count: { select: { products: { where: active } } },
      },
    }),
    prisma.product.findMany({
      where: active,
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    }),
  ]);

  const min = aggregate._min.price ?? 0;
  const max = aggregate._max.price ?? 0;

  const categoryLines = categories
    .filter((category) => category._count.products > 0)
    .map((category) => {
      const name = locale === "ka" ? category.nameKa : category.nameEn;
      return `- ${name} (/catalog?category=${category.slug}) — ${category._count.products}`;
    })
    .join("\n");

  const brandList = brands
    .map((row) => row.brand)
    .filter(Boolean)
    .join(", ");

  return [
    `Products for sale: ${total} (${inStock} currently in stock).`,
    `Price range: ${formatPrice(min, locale)} – ${formatPrice(max, locale)}.`,
    "",
    "Categories, with how many products each holds:",
    categoryLines,
    "",
    `Brands carried: ${brandList}`,
  ].join("\n");
}

/** The information pages, flattened to plain text the model can quote from. */
async function infoPagesText(locale: Locale): Promise<string> {
  const pages = await Promise.all(CONTEXT_PAGES.map((slug) => getPage(slug, locale)));

  return pages
    .map((page) => {
      const body = page.sections
        .map((section) => `### ${section.heading}\n${section.body.join("\n")}`)
        .join("\n\n");
      return `## ${page.title}  (/${page.slug})\n${page.intro}\n\n${body}`;
    })
    .join("\n\n");
}

/** The rules the code actually enforces, so the assistant can't soften them. */
function shippingRules(locale: Locale, settings: ShopSettings): string {
  return [
    `Shipping costs ${formatPrice(settings.shippingFee, locale)}, and is free once the basket reaches ${formatPrice(settings.freeShippingThreshold, locale)}.`,
    "Delivery time is set per product and is shown on the product page — there is no single site-wide figure.",
    "Payment is cash on delivery. Card payments are not connected yet, so do not offer them.",
    "An order can be placed without an account; tracking one afterwards needs the order number and the phone number given at checkout (/track).",
  ].join("\n");
}

/**
 * The whole standing context, cached per locale.
 *
 * The cache is what keeps the system prompt identical between requests. Prompt
 * caching is a prefix match, so re-querying the counts on every message would
 * change a byte somewhere and quietly cost full price every time.
 */
export async function shopContext(locale: Locale): Promise<string> {
  const cached = contextCache.get(locale);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  const settings = await getSettings();

  const text = [
    `# ${settings.name} — shop facts`,
    "",
    await catalogueSummary(locale),
    "",
    "## Shipping, payment and orders",
    shippingRules(locale, settings),
    "",
    "# Information pages, verbatim",
    await infoPagesText(locale),
  ].join("\n");

  contextCache.set(locale, { text, expiresAt: Date.now() + CONTEXT_TTL_MS });
  return text;
}

/** Test seam — the cache would otherwise outlive a changed fixture. */
export function clearShopContextCache() {
  contextCache.clear();
}

/* ------------------------------------------------------------------ */
/* Live lookups                                                        */
/* ------------------------------------------------------------------ */

export type ProductMatch = {
  name: string;
  slug: string;
  url: string;
  brand: string;
  price: string;
  oldPrice: string | null;
  inStock: boolean;
  stock: number;
  shippingDays: number;
  category: string;
};

const MAX_MATCHES = 6;

function toMatch(
  product: {
    slug: string;
    nameKa: string;
    nameEn: string;
    brand: string;
    price: number;
    oldPrice: number | null;
    stock: number;
    shippingDays: number;
    category: { nameKa: string; nameEn: string };
  },
  locale: Locale,
): ProductMatch {
  return {
    name: locale === "ka" ? product.nameKa : product.nameEn,
    slug: product.slug,
    url: `/product/${product.slug}`,
    brand: product.brand,
    price: formatPrice(product.price, locale),
    oldPrice: product.oldPrice ? formatPrice(product.oldPrice, locale) : null,
    inStock: product.stock > 0,
    stock: product.stock,
    shippingDays: product.shippingDays,
    category: locale === "ka" ? product.category.nameKa : product.category.nameEn,
  };
}

const matchSelect = {
  slug: true,
  nameKa: true,
  nameEn: true,
  brand: true,
  price: true,
  oldPrice: true,
  stock: true,
  shippingDays: true,
  category: { select: { nameKa: true, nameEn: true } },
} as const;

/**
 * Free-text product search, mirroring what the catalogue page does.
 *
 * `mode: "insensitive"` is required because Postgres `LIKE` is case-sensitive
 * — without it "anker" would not find "Anker" and the assistant would tell a
 * customer the shop doesn't stock something it does.
 */
export async function searchProducts(
  query: string,
  locale: Locale,
  options: { categorySlug?: string; inStockOnly?: boolean } = {},
): Promise<ProductMatch[]> {
  const trimmed = query.trim();
  const contains = { contains: trimmed, mode: "insensitive" } as const;

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(options.inStockOnly ? { stock: { gt: 0 } } : {}),
      ...(options.categorySlug ? { category: { slug: options.categorySlug } } : {}),
      ...(trimmed
        ? {
            OR: [
              { nameKa: contains },
              { nameEn: contains },
              { brand: contains },
              { descriptionKa: contains },
              { descriptionEn: contains },
            ],
          }
        : {}),
    },
    select: matchSelect,
    // In stock first: a perfect match nobody can buy is a worse answer than a
    // near match they can.
    orderBy: [{ stock: "desc" }, { price: "asc" }, { id: "asc" }],
    take: MAX_MATCHES,
  });

  return products.map((product) => toMatch(product, locale));
}

export type ProductDetail = ProductMatch & { description: string; sku: string };

export async function getProductBySlug(
  slug: string,
  locale: Locale,
): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: { ...matchSelect, sku: true, descriptionKa: true, descriptionEn: true },
  });
  if (!product) return null;

  return {
    ...toMatch(product, locale),
    sku: product.sku,
    description: locale === "ka" ? product.descriptionKa : product.descriptionEn,
  };
}

export type CategorySummary = { name: string; url: string; products: number };

export async function listCategories(locale: Locale): Promise<CategorySummary[]> {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      nameKa: true,
      nameEn: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });

  return categories
    .filter((category) => category._count.products > 0)
    .map((category) => ({
      name: locale === "ka" ? category.nameKa : category.nameEn,
      url: `/catalog?category=${category.slug}`,
      products: category._count.products,
    }));
}
