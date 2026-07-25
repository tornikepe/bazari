import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatPrice } from "@/lib/format";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { PlusIcon } from "@/components/ui/icons";
import type { RawSearchParams } from "@/lib/filters";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() ?? "";

  const products = await prisma.product.findMany({
    where: query
      ? {
          OR: [
            { nameKa: { contains: query } },
            { nameEn: { contains: query } },
            { brand: { contains: query } },
            { slug: { contains: query } },
          ],
        }
      : undefined,
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-ink-900">
          {t.admin.products}
          <span className="ml-2 text-sm font-medium text-ink-400">{products.length}</span>
        </h1>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <AdminSearch basePath="/admin/products" initial={query} />
          <Link href="/admin/products/new" className="btn btn-primary btn-sm shrink-0">
            <PlusIcon size={15} />
            {t.admin.newProduct}
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="card mt-5 px-6 py-16 text-center">
          <p className="text-sm text-ink-500">{t.admin.noProducts}</p>
        </div>
      ) : (
        <div className="card mt-5 overflow-hidden">
          {/* Horizontal scroll keeps the table usable on narrow screens. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left">
              <thead className="border-b border-line bg-ink-50 text-xs font-bold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">{t.cart.item}</th>
                  <th className="px-4 py-2.5">{t.admin.categoryField}</th>
                  <th className="px-4 py-2.5 text-right">{t.admin.price}</th>
                  <th className="px-4 py-2.5 text-right">{t.admin.stock}</th>
                  <th className="px-4 py-2.5 text-right">{t.admin.status}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line">
                {products.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-ink-50">
                    <td className="px-4 py-2.5">
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
                            href={`/admin/products/${product.id}`}
                            className="line-clamp-1 text-xs font-semibold text-ink-900 hover:text-brand-600"
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

                    <td className="px-4 py-2.5">
                      <span className="text-xs text-ink-600">
                        {product.category.icon}{" "}
                        {locale === "ka" ? product.category.nameKa : product.category.nameEn}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <span className="text-xs font-semibold text-ink-900">
                        {formatPrice(product.price, locale)}
                      </span>
                      {product.oldPrice && (
                        <span className="block text-xs text-ink-400 line-through">
                          {formatPrice(product.oldPrice, locale)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`badge ${
                          product.stock === 0
                            ? "bg-danger-soft text-danger"
                            : product.stock <= 10
                              ? "bg-warning-soft text-warning"
                              : "bg-ink-100 text-ink-600"
                        }`}
                      >
                        {product.stock}
                      </span>
                    </td>

                    <td className="px-4 py-2.5">
                      <ProductRowActions id={product.id} isActive={product.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
