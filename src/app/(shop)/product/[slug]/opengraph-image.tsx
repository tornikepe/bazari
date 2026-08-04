import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getLocale } from "@/lib/locale";
import { formatPrice } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

/**
 * The card a product link shows when it is pasted into a chat or a feed.
 *
 * Typographic rather than photographic, and deliberately so: every product
 * currently shares one placeholder image, so a card built around the photo
 * would show the same grey box for all forty. The name, the brand and the
 * price are real and distinct, so they are what the card is made of — in the
 * same ruled, square language as the site.
 *
 * The font is loaded from a file rather than left to a fallback. `ImageResponse`
 * renders through Satori, which has no font fallback chain the way a browser
 * does: without Georgian glyphs supplied explicitly, every Georgian product
 * name would render as empty boxes. Noto Sans Georgian is OFL-licensed, and
 * the 59KB static instance is committed rather than fetched at build time so a
 * deploy never depends on Google being reachable.
 */

export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProductOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [product, locale, font] = await Promise.all([
    prisma.product.findFirst({
      where: { slug, isActive: true },
      select: {
        nameKa: true,
        nameEn: true,
        brand: true,
        price: true,
        stock: true,
        category: { select: { nameKa: true, nameEn: true } },
      },
    }),
    getLocale(),
    readFile(join(process.cwd(), "assets", "NotoSansGeorgian-Bold.ttf")),
  ]);

  // A withdrawn product still gets a card — a blank one is worse than a plain
  // one, and the page itself already answers 404.
  const name = product ? (locale === "ka" ? product.nameKa : product.nameEn) : SITE_NAME;
  const category = product
    ? locale === "ka"
      ? product.category.nameKa
      : product.category.nameEn
    : "";

  const fonts = [{ name: "Noto Sans Georgian", data: font, weight: 700 as const, style: "normal" as const }];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          color: "#161a23",
          fontFamily: "Noto Sans Georgian",
          padding: 72,
          // The one rule that frames the whole card, matching the site.
          borderTop: "14px solid #dc1f24",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#5f6675" }}>
            {(product?.brand || category || SITE_NAME).toUpperCase()}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#161a23" }}>{SITE_NAME}</div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: name.length > 42 ? 62 : 78,
            lineHeight: 1.1,
            letterSpacing: -2,
            maxWidth: 1000,
          }}
        >
          {name}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderTop: "2px solid #d7dbe2",
            paddingTop: 28,
          }}
        >
          {/* Real figures only — the price and stock are read from the row,
              never rounded or dressed up. */}
          <div style={{ display: "flex", fontSize: 64, letterSpacing: -2 }}>
            {product ? formatPrice(product.price, locale) : ""}
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#5f6675" }}>
            {product && product.stock > 0 ? (locale === "ka" ? "მარაგშია" : "In stock") : ""}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
