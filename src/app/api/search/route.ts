import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, consume } from "@/lib/rate-limit";
import { matchingProductIds } from "@/lib/search";

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
    /* The same matcher and the same order the catalogue uses, which is the
       whole point of it living in one place: a product offered in this
       dropdown and missing from the page you land on after pressing enter is
       the sort of fault nobody reports and everybody notices. */
    const ranked = (await matchingProductIds(query)).slice(0, LIMIT);
    if (ranked.length === 0) return NextResponse.json({ products: [] });

    const rows = await prisma.product.findMany({
      where: { id: { in: ranked } },
      select: {
        id: true,
        slug: true,
        nameKa: true,
        nameEn: true,
        price: true,
        image: true,
        brand: true,
      },
    });

    // Back into the order the search gave them; `IN` has none of its own. The
    // id is dropped on the way out — the dropdown navigates by slug, and an id
    // is an internal handle nothing outside the server needs.
    const byId = new Map(rows.map((row) => [row.id, row]));
    const products = ranked.flatMap((id) => {
      const row = byId.get(id);
      return row ? [{ slug: row.slug, nameKa: row.nameKa, nameEn: row.nameEn, price: row.price, image: row.image, brand: row.brand }] : [];
    });

    return NextResponse.json({ products });
  } catch (error) {
    // A failed suggestion is not a failed search: the form still submits and
    // the catalogue still answers. Returning empty keeps the field usable.
    console.error("[search] suggestions failed", error);
    return NextResponse.json({ products: [] });
  }
}
