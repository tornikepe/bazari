import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";
import { StockLedger } from "@/components/admin/StockLedger";
import { RestockPanel } from "@/components/admin/RestockPanel";
import { VariantsPanel } from "@/components/admin/VariantsPanel";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories, options, variants] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameKa: true, nameEn: true, icon: true },
    }),
    prisma.productOption.findMany({
      where: { productId: id },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        nameKa: true,
        nameEn: true,
        values: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, valueKa: true, valueEn: true },
        },
      },
    }),
    prisma.productVariant.findMany({
      where: { productId: id },
      orderBy: { sortOrder: "asc" },
      select: {
        sku: true,
        price: true,
        stock: true,
        isActive: true,
        values: { select: { valueId: true } },
      },
    }),
  ]);

  if (!product) notFound();

  return (
    <>
      <ProductForm product={product} categories={categories} />

      {/* One column for the whole page: the form is `max-w-4xl` and the ledger
          below it was full width, so the two disagreed about where the page
          ends. Restocking sits above the ledger because it is the thing that
          writes to it. */}
      <div className="mx-auto max-w-4xl">
        <VariantsPanel
          productId={product.id}
          options={options}
          variants={variants.map((variant) => ({
            valueIds: variant.values.map((value) => value.valueId),
            sku: variant.sku,
            price: variant.price,
            stock: variant.stock,
            isActive: variant.isActive,
          }))}
        />
        <RestockPanel productId={product.id} />
        <StockLedger productId={product.id} />
      </div>
    </>
  );
}
