import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productCardSelect } from "@/lib/catalog";
import { MAX_VIEWED } from "@/lib/recently-viewed-store";

/**
 * Resolves a list of product ids into cards.
 *
 * The recently-viewed list lives in the browser, so the server cannot know it
 * at render time — the ids have to come *from* the client. Only ids travel:
 * names, prices and stock are read here, so a product the shop has since
 * repriced or withdrawn is never drawn from a stale copy in `localStorage`.
 *
 * Published products only, and no more than the store itself keeps. A crafted
 * request cannot use this to enumerate the catalogue any faster than
 * `/catalog` already allows.
 */
export async function GET(request: Request) {
  const ids = (new URL(request.url).searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_VIEWED);

  if (ids.length === 0) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    select: productCardSelect,
  });

  /* Returned in the order they were asked for. The database has no opinion
     about "most recently viewed", and sorting here rather than in the client
     keeps the store the only place that knows the order. */
  const byId = new Map(products.map((product) => [product.id, product]));

  return NextResponse.json(
    { products: ids.map((id) => byId.get(id)).filter(Boolean) },
    // Private: this answer is about one browser's history, however little it
    // reveals, and a shared cache holding it would serve it to someone else.
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
