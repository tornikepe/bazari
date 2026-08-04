import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAME, SITE_TITLE } from "@/lib/site";

/**
 * The card for every route that does not generate its own — the home page,
 * the catalogue, the information pages.
 *
 * Same construction as the product card: a rule, a name, and nothing invented.
 * Deliberately does not count products or categories: this image is statically
 * generated at build time, so any figure baked into it would be frozen at
 * whatever the catalogue held on the day of the deploy, and a stale number is
 * worse than no number.
 */

export const alt = SITE_TITLE;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SiteOgImage() {
  const font = await readFile(join(process.cwd(), "assets", "NotoSansGeorgian-Bold.ttf"));

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
          borderTop: "14px solid #dc1f24",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: "#5f6675" }}>
          ᲝᲜᲚᲐᲘᲜ ᲛᲐᲦᲐᲖᲘᲐ
        </div>

        <div style={{ display: "flex", fontSize: 132, letterSpacing: -5 }}>{SITE_NAME}</div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#5f6675",
            borderTop: "2px solid #d7dbe2",
            paddingTop: 28,
          }}
        >
          ტექნიკა და აქსესუარები ერთ ადგილას
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Noto Sans Georgian", data: font, weight: 700 as const, style: "normal" as const },
      ],
    },
  );
}
