import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, nameKa: true, nameEn: true, icon: true },
  });

  // A product needs a category, so send the admin to create one first.
  if (categories.length === 0) redirect("/admin/categories");

  return <ProductForm categories={categories} />;
}
