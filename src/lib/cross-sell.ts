import "server-only";
import { prisma } from "@/lib/prisma";
import { productCardSelect, type ProductCardData } from "@/lib/catalog";

/**
 * What people who bought this also bought.
 *
 * Counted from the orders this shop has actually taken — a join of
 * `OrderItem` against itself — and never approximated. If nothing has been
 * bought alongside this product, the section does not appear; a "customers
 * also bought" row filled with whatever happened to be in the same category
 * is a recommendation nobody made, and this project does not invent numbers
 * for the same reason it does not invent reviews.
 *
 * Cancelled orders are excluded. Two things in a basket that was never paid
 * for is not evidence that they go together.
 */
export async function getBoughtTogether(
  productId: string,
  take = 4,
): Promise<ProductCardData[]> {
  /*
   * The pairing is done in SQL because it is a self-join with a count, and
   * pulling every order this product appears in to group them in JavaScript
   * would move a table across the wire to answer a question Postgres answers
   * with an index.
   *
   * `DISTINCT "OrderItem"."orderId"` matters: an order holding two lines of
   * the same product would otherwise count its neighbour twice.
   */
  const pairs = await prisma.$queryRaw<{ productId: string; orders: bigint }[]>`
    SELECT other."productId" AS "productId",
           COUNT(DISTINCT other."orderId") AS "orders"
      FROM "OrderItem" mine
      JOIN "OrderItem" other
        ON other."orderId" = mine."orderId"
       AND other."productId" <> mine."productId"
      JOIN "Order" o
        ON o.id = mine."orderId"
     WHERE mine."productId" = ${productId}
       AND o.status <> 'cancelled'
       AND other."productId" IS NOT NULL
     GROUP BY other."productId"
     ORDER BY "orders" DESC, other."productId" ASC
     LIMIT ${take * 3}
  `;

  if (pairs.length === 0) return [];

  const ids = pairs.map((pair) => pair.productId);

  /* A second query rather than a join onto `Product`: the ranking is about
     orders and the card is about the product, and a withdrawn or sold-out
     product must drop out of the row without changing the ranking above it —
     which is why the SQL above asks for more ids than the row will show. */
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    select: productCardSelect,
  });

  const byId = new Map(products.map((product) => [product.id, product]));

  return ids
    .map((id) => byId.get(id))
    .filter((product): product is ProductCardData => product !== undefined)
    .slice(0, take);
}
