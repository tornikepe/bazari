import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getSettings } from "@/lib/settings";
import { getI18n } from "@/lib/locale";
import { fill } from "@/lib/i18n";

/**
 * The card for every route that does not generate its own — the home page,
 * the catalogue, the information pages.
 *
 * Same construction as the product card: a rule, a name, and nothing invented.
 * Deliberately counts nothing — not products, not categories. A figure drawn
 * into a shared picture is read months later, and a stale number is worse
 * than no number.
 *
 * The three lines are the shop's own: its name, its suffix and its tagline,
 * read at request time. They used to be constants, which meant renaming the
 * shop left the old name on every card it had ever been shared with.
 */

export const alt = "Online store";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SiteOgImage() {
  const [font, settings, { locale, t }] = await Promise.all([
    readFile(join(process.cwd(), "assets", "NotoSansGeorgian-Bold.ttf")),
    getSettings(),
    getI18n(),
  ]);

  const suffix = locale === "ka" ? settings.titleSuffixKa : settings.titleSuffixEn;
  const written =
    (locale === "ka" ? settings.taglineKa : settings.taglineEn) ||
    fill(t.footer.about, { name: settings.name });

  /* Two lines of it fit under the rule. A tagline longer than that would
     climb into the name above, so it is cut at the last whole word. */
  const tagline =
    written.length <= 120 ? written : `${written.slice(0, 120).replace(/\s+\S*$/, "")}…`;

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
          {suffix.toUpperCase()}
        </div>

        <div style={{ display: "flex", fontSize: 132, letterSpacing: -5 }}>{settings.name}</div>

        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#5f6675",
            borderTop: "2px solid #d7dbe2",
            paddingTop: 28,
          }}
        >
          {tagline}
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
