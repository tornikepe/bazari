import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, consume } from "@/lib/rate-limit";
import { searchPredicate } from "@/lib/catalog";

/**
 * Product suggestions for the header search field.
 *
 * The predicate is imported from `catalog.ts` rather than written again here.
 * Two copies would be two definitions of what "matches" means, and the failure
 * would be silent and maddening: a product offered in the dropdown that is
 * missing from the results page you land on after pressing enter.
 *
 * Six results, no paging, no facets. This is a shortcut to a product someone is
 * already halfway to naming — anything more is the catalogue, which exists.
 */

/** Below this a query matches most of the shop and suggests nothing useful. */
const MIN_LENGTH = 2;
const LIMIT = 6;

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);

  if (query.length < MIN_LENGTH) {
    return NextResponse.json({ products: [] });
  }

  // One keystroke is one request, so this is the one endpoint on the site a
  // person hits by typing normally. The ceiling is set well above what a fast
  // typist reaches through the debounce and well below what a script does.
  const throttle = await consume(`search:ip:${await clientIp()}`, 120, 60);
  if (!throttle.ok) {
    return NextResponse.json({ products: [] }, { status: 429 });
  }

  try {
    const products = await prisma.product.findMany({
      where: searchPredicate(query),
      select: {
        slug: true,
        nameKa: true,
        nameEn: true,
        price: true,
        image: true,
        brand: true,
      },
      // The newest match first, matching the catalogue's own default order so
      // the first suggestion is the first result.
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    });

    return NextResponse.json({ products });
  } catch (error) {
    // A failed suggestion is not a failed search: the form still submits and
    // the catalogue still answers. Returning empty keeps the field usable.
    console.error("[search] suggestions failed", error);
    return NextResponse.json({ products: [] });
  }
}
