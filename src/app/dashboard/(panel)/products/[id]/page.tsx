import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";
import { StockLedger } from "@/components/admin/StockLedger";
import { RestockPanel } from "@/components/admin/RestockPanel";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameKa: true, nameEn: true, icon: true },
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
        <RestockPanel productId={product.id} />
        <StockLedger productId={product.id} />
      </div>
    </>
  );
}
