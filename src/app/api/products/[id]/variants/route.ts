import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * A product's options and variants, for the catalogue card.
 *
 * The card carries only a count of options — enough to know a size has to
 * be chosen, not enough to offer the choice. Rather than ship every size of
 * every product with every page of twelve cards, the card asks for them
 * the moment its button is pressed. Both languages come back and the card
 * picks; the answer is the same for every visitor, so it is cacheable.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    select: {
      price: true,
      options: {
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
      },
      variants: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          sku: true,
          price: true,
          stock: true,
          isActive: true,
          values: { select: { valueId: true } },
        },
      },
    },
  });

  if (!product) return NextResponse.json({ error: "not-found" }, { status: 404 });

  return NextResponse.json(
    {
      price: product.price,
      options: product.options,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        price: variant.price,
        stock: variant.stock,
        isActive: variant.isActive,
        valueIds: variant.values.map((value) => value.valueId),
      })),
    },
    // Stock moves, so a minute at most; the sizes themselves change once a season.
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
  );
}
