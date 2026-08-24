import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatPrice } from "@/lib/format";
import { fill } from "@/lib/i18n";
import { AdminToolbar, type SelectFilter } from "@/components/admin/AdminToolbar";
import { WriteOnly } from "@/components/admin/StaffRoleProvider";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { BulkProducts } from "@/components/admin/BulkProducts";
import { PlusIcon } from "@/components/ui/icons";
import type { Prisma } from "@/generated/prisma/client";
import type { RawSearchParams } from "@/lib/filters";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyShelfArt, NoResultsArt } from "@/components/ui/illustrations";
import { PageHeader } from "@/components/layout/PageHeader";

const PAGE_SIZE = 20;
const LOW_STOCK_THRESHOLD = 10;

const STATUSES = ["active", "inactive", "low", "out"] as const;
const SORTS = ["newest", "name", "price-desc", "stock-asc"] as const;

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function buildWhere(query: string, status: string, category: string): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  if (query) {
    // Postgres LIKE is case-sensitive, so this needs `mode: "insensitive"`.
    const contains = { contains: query, mode: "insensitive" } as const;
    and.push({
      OR: [
        { nameKa: contains },
        { nameEn: contains },
        { brand: contains },
        { slug: contains },
      ],
    });
  }

  if (category) and.push({ category: { slug: category } });

  if (status === "active") and.push({ isActive: true });
  if (status === "inactive") and.push({ isActive: false });
  if (status === "out") and.push({ stock: { lte: 0 } });
  if (status === "low") and.push({ stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } });

  return and.length ? { AND: and } : {};
}

function buildOrderBy(sort: string): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ nameKa: "asc" }, { id: "asc" }];
    case "price-desc":
      return [{ price: "desc" }, { id: "asc" }];
    case "stock-asc":
      return [{ stock: "asc" }, { id: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;

  const query = one(params.q);
  const statusRaw = one(params.status);
  const status = (STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : "";
  const category = one(params.category);

  /* One name for "the reader is looking at a subset", because the empty
     state has to say something different in each case. */
  const filtered = Boolean(query || status || category);
  const sortRaw = one(params.sort);
  const sort = (SORTS as readonly string[]).includes(sortRaw) ? sortRaw : "newest";
  const pageRaw = Number(one(params.page));
  const requestedPage = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const where = buildWhere(query, status, category);

  const [total, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, nameKa: true, nameEn: true },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const products = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: buildOrderBy(sort),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const filters: SelectFilter[] = [
    {
      name: "category",
      label: t.admin.filterCategory,
      value: category,
      options: [
        { value: "", label: t.admin.filterCategory },
        ...categories.map((entry) => ({
          value: entry.slug,
          label: locale === "ka" ? entry.nameKa : entry.nameEn,
        })),
      ],
    },
    {
      name: "status",
      label: t.admin.filterStatus,
      value: status,
      options: [
        { value: "", label: t.admin.filterStatus },
        { value: "active", label: t.admin.filterActive },
        { value: "inactive", label: t.admin.filterInactive },
        { value: "low", label: t.admin.filterLowStock },
        { value: "out", label: t.admin.filterOutOfStock },
      ],
    },
    {
      name: "sort",
      label: t.admin.sortBy,
      value: sort === "newest" ? "" : sort,
      options: [
        { value: "", label: t.admin.sortNewest },
        { value: "name", label: t.admin.sortName },
        { value: "price-desc", label: t.admin.sortPriceDesc },
        { value: "stock-asc", label: t.admin.sortStockAsc },
      ],
    },
  ];

  const stockTone = (stock: number) =>
    stock === 0
      ? "bg-danger-soft text-danger"
      : stock <= LOW_STOCK_THRESHOLD
        ? "bg-warning-soft text-warning"
        : "bg-ink-100 text-ink-600";

  return (
    <div className="mx-auto max-w-6xl">
      <ReadOnlyNotice />

      <PageHeader
        scale="panel"
        title={t.admin.products}
        count={total}
        action={
          <WriteOnly>
            <Link href="/dashboard/products/new" className="btn btn-primary btn-sm">
              <PlusIcon size={15} />
              {t.admin.newProduct}
            </Link>
          </WriteOnly>
        }
      />

      <div className="mt-4">
        <AdminToolbar
          basePath="/dashboard/products"
          search={query}
          filters={filters}
          hasActive={Boolean(query || status || category || sort !== "newest")}
        />
      </div>

      {products.length === 0 ? (
        <EmptyState
          className="card mt-4"
          art={filtered ? <NoResultsArt size={88} /> : <EmptyShelfArt size={88} />}
          title={filtered ? t.admin.noMatches : t.admin.noProducts}
          text={filtered ? t.admin.noMatchesHint : t.admin.noProductsHint}
          titleAs="p"
          action={
            /* The action has to match what is actually wrong. Offering "new
               product" to someone whose search found nothing is an answer to
               a question they did not ask. */
            filtered ? (
              <Link href="/dashboard/products" className="btn btn-outline btn-md">
                {t.admin.resetFilters}
              </Link>
            ) : (
              <WriteOnly>
                <Link href="/dashboard/products/new" className="btn btn-primary btn-md">
                  <PlusIcon size={15} />
                  {t.admin.newProduct}
                </Link>
              </WriteOnly>
            )
          }
        />
      ) : (
        <>
          <p className="mt-3 text-xs text-ink-400">
            {fill(t.admin.showingCount, {
              from: (page - 1) * PAGE_SIZE + 1,
              to: (page - 1) * PAGE_SIZE + products.length,
              total,
            })}
          </p>

          <BulkProducts ids={products.map((product) => product.id)}>
          {/* Cards on small screens — a six-column table can't shrink far
              enough to stay readable on a phone. */}
          <ul className="mt-3 flex flex-col gap-2 lg:hidden">
            {products.map((product) => (
              <li key={product.id} className="card flex gap-3 card-pad-tight">
                <WriteOnly>
                  <label className="flex shrink-0 items-start pt-1">
                    <span className="sr-only">
                      {fill(t.admin.bulkSelectRow, {
                        name: locale === "ka" ? product.nameKa : product.nameEn,
                      })}
                    </span>
                    <input
                      type="checkbox"
                      name="product-id"
                      value={product.id}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </label>
                </WriteOnly>

                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-ink-50">
                  <Image src={product.image} alt="" fill sizes="64px" className="object-cover" />
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/dashboard/products/${product.id}`}
                    className="clamp-2 text-sm font-semibold text-ink-900"
                  >
                    {locale === "ka" ? product.nameKa : product.nameEn}
                  </Link>

                  <p className="truncate text-xs text-ink-400">
                    {product.category.icon}{" "}
                    {locale === "ka" ? product.category.nameKa : product.category.nameEn}
                    {product.brand && ` · ${product.brand}`}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink-900">
                      {formatPrice(product.price, locale)}
                    </span>
                    <span className={`badge ${stockTone(product.stock)}`}>{product.stock}</span>
                    {product.isFeatured && (
                      <span className="badge bg-brand-50 text-brand-700">{t.admin.featured}</span>
                    )}
                  </div>

                  <div className="mt-1">
                    <ProductRowActions id={product.id} isActive={product.isActive} />
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Table from lg upwards */}
          <div className="card mt-3 hidden overflow-hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  {/* No header checkbox: select-all lives above the table so
                      that it exists at every width, and a column heading of
                      one control reads as a column of data. */}
                  <WriteOnly>
                    <th className="w-10">
                      <span className="sr-only">{t.admin.bulkSelectAll}</span>
                    </th>
                  </WriteOnly>
                  <th>{t.cart.item}</th>
                  <th>{t.admin.categoryField}</th>
                  <th className="figures">{t.admin.price}</th>
                  <th className="figures">{t.admin.stock}</th>
                  <th className="figures">{t.admin.status}</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <WriteOnly>
                      <td>
                        <label className="flex items-center">
                          <span className="sr-only">
                            {fill(t.admin.bulkSelectRow, {
                              name: locale === "ka" ? product.nameKa : product.nameEn,
                            })}
                          </span>
                          <input
                            type="checkbox"
                            name="product-id"
                            value={product.id}
                            className="h-4 w-4 accent-brand-600"
                          />
                        </label>
                      </td>
                    </WriteOnly>

                    <td>
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-control bg-ink-50">
                          <Image
                            src={product.image}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>

                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/products/${product.id}`}
                            className="line-clamp-1 text-sm font-semibold text-ink-900 hover:text-brand-600"
                          >
                            {locale === "ka" ? product.nameKa : product.nameEn}
                          </Link>
                          <p className="truncate text-xs text-ink-400">
                            {product.brand || "—"}
                            {product.isFeatured && ` · ${t.admin.featured}`}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="text-xs text-ink-600">
                        {product.category.icon}{" "}
                        {locale === "ka" ? product.category.nameKa : product.category.nameEn}
                      </span>
                    </td>

                    <td className="figures">
                      <span className="text-sm font-semibold text-ink-900">
                        {formatPrice(product.price, locale)}
                      </span>
                      {product.oldPrice && (
                        <span className="block text-xs text-ink-400 line-through">
                          {formatPrice(product.oldPrice, locale)}
                        </span>
                      )}
                    </td>

                    <td className="figures">
                      <span className={`badge ${stockTone(product.stock)}`}>{product.stock}</span>
                    </td>

                    <td>
                      <ProductRowActions id={product.id} isActive={product.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </BulkProducts>

          <AdminPagination
            basePath="/dashboard/products"
            params={{ q: query, status, category, sort: sort === "newest" ? "" : sort }}
            page={page}
            pageCount={pageCount}
            labels={{ previous: t.common.previous, next: t.common.next, page: t.common.page }}
          />
        </>
      )}
    </div>
  );
}
