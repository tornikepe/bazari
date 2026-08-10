import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  deriveBrandTheme,
  auditBrandTheme,
  checkBrandColor,
  brandThemeCss,
  brandDrift,
  DEFAULT_BRAND_COLOR,
  BRAND_TOKENS,
  AA_TEXT,
} from "@/lib/brand-theme";
import { contrastHex, hexToOklch, oklchToHex } from "@/lib/color";

/**
 * The point of the whole module is one claim: whatever colour a shop owner
 * picks, the site still meets AA. A test that checks three colours does not
 * establish that, so this sweeps the hue circle.
 */
const HUES = Array.from({ length: 24 }, (_, i) => i * 15);

/** A spread of real brand colours, including the awkward ones. */
const REAL_BRANDS = [
  "#dc1f24", // this shop's red
  "#1877f2", // a social blue
  "#25d366", // a messaging green
  "#ff9900", // an orange
  "#6b21a8", // a deep purple
  "#000000", // black
  "#767676", // grey — no chroma at all
  "#ffd400", // bright yellow, the hardest case
  "#00e5ff", // bright cyan
  "#c0ff00", // lime
];

describe("the template matches globals.css", () => {
  // The module keeps its own copy of the default ramp. If the stylesheet is
  // edited and this is not, every derived palette is cut from a stale shape.
  const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

  const read = (block: string) => {
    const found: Record<string, string> = {};
    for (const [, name, value] of block.matchAll(/--color-(brand-[\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
      found[name] = value;
    }
    return found;
  };

  const themeBlock = css.slice(css.indexOf("@theme {"), css.indexOf('[data-theme="dark"]'));
  const darkStart = css.indexOf('[data-theme="dark"] {');
  const darkBlock = css.slice(darkStart, css.indexOf("\n}", darkStart));

  it("reproduces the stylesheet exactly for the default colour", () => {
    const theme = deriveBrandTheme(DEFAULT_BRAND_COLOR)!;
    const light = read(themeBlock);
    const dark = { ...light, ...read(darkBlock) };

    for (const token of BRAND_TOKENS) {
      expect(theme.light[token], `light ${token}`).toBe(light[token]);
      expect(theme.dark[token], `dark ${token}`).toBe(dark[token]);
    }
  });
});

describe("derivation", () => {
  it("refuses input that is not a colour", () => {
    for (const bad of ["", "nonsense", "#12345", "rgb(0,0,0)"]) {
      expect(deriveBrandTheme(bad), bad).toBeNull();
    }
  });

  it("produces a real hex for every token, in both themes", () => {
    for (const brand of REAL_BRANDS) {
      const theme = deriveBrandTheme(brand)!;
      for (const token of BRAND_TOKENS) {
        expect(theme.light[token], `${brand} light ${token}`).toMatch(/^#[0-9a-f]{6}$/);
        expect(theme.dark[token], `${brand} dark ${token}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("keeps the hue that was asked for", () => {
    for (const hue of HUES) {
      // Built from OKLCH so the hue being asked for is exact.
      const input = oklchToHex({ l: 0.55, c: 0.17, h: hue });
      const theme = deriveBrandTheme(input)!;
      const got = hexToOklch(theme.light["brand-600"])!;

      // Only compare when the shade has enough chroma for a hue to mean
      // anything — a near-grey's hue is noise.
      if (got.c > 0.02) {
        // Circular distance: the +540/-180 dance already folds the difference
        // into ±180, so this is the angle itself, not its complement.
        const delta = Math.abs(((got.h - hue + 540) % 360) - 180);
        expect(delta, `hue ${hue}`).toBeLessThan(6);
      }
    }
  });
});

describe("AA holds for every hue", () => {
  it.each(HUES)("hue %i", (hue) => {
    // Mid lightness, strong chroma — a typical logo colour.
    const input = oklchToHex({ l: 0.62, c: 0.19, h: hue });
    const theme = deriveBrandTheme(input)!;

    for (const row of auditBrandTheme(theme)) {
      expect(
        row.ratio,
        `${row.theme}: ${row.label} — ${row.fg} on ${row.bg} is ${row.ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe("AA holds for real brand colours", () => {
  it.each(REAL_BRANDS)("%s", (brand) => {
    const theme = deriveBrandTheme(brand)!;
    for (const row of auditBrandTheme(theme)) {
      expect(
        row.ratio,
        `${row.theme}: ${row.label} — ${row.fg} on ${row.bg} is ${row.ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe("AA holds across lightness too", () => {
  it("passes for very light and very dark picks", () => {
    for (const l of [0.25, 0.4, 0.55, 0.7, 0.85, 0.95]) {
      for (const hue of [0, 60, 120, 200, 280]) {
        const input = oklchToHex({ l, c: 0.15, h: hue });
        const theme = deriveBrandTheme(input)!;
        for (const row of auditBrandTheme(theme)) {
          expect(row.ratio, `L${l} hue${hue} ${row.theme} ${row.label}`).toBeGreaterThanOrEqual(AA_TEXT);
        }
      }
    }
  });
});

describe("the button flips its text rather than ruining a light brand", () => {
  it("keeps white on a dark brand", () => {
    const red = deriveBrandTheme("#dc1f24")!;
    expect(red.light["brand-on-solid"]).toBe("#ffffff");
  });

  it("switches to dark text where that is the readable choice", () => {
    // Green, not yellow. Green carries the largest share of luminance (0.7152
    // of it), so at the ramp's lightness a green button is bright enough that
    // dark text reads better on it than white — which is the whole reason this
    // is a choice rather than a constant. A yellow does *not* reach this branch:
    // its solid derives to a dark olive, and that colour is refused for drift
    // long before anyone sees it.
    const green = deriveBrandTheme("#3fbd12")!;
    expect(green.light["brand-on-solid"]).not.toBe("#ffffff");
    expect(
      contrastHex(green.light["brand-on-solid"], green.light["brand-solid"]),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("would have been worse with white forced on it", () => {
    // The justification for the branch, stated as a measurement: on this green
    // white does not reach AA, so a fixed white would have forced the button
    // itself to be darkened away from the brand.
    const green = deriveBrandTheme("#3fbd12")!;
    expect(contrastHex("#ffffff", green.light["brand-solid"])).toBeLessThan(AA_TEXT);
  });
});

describe("checkBrandColor", () => {
  it("accepts the shop's own colour with no drift", () => {
    const result = checkBrandColor(DEFAULT_BRAND_COLOR);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.drift).toBeCloseTo(0, 5);
  });

  it("accepts an ordinary brand colour", () => {
    const result = checkBrandColor("#1877f2");
    expect(result.ok).toBe(true);
  });

  it("rejects what is not a colour", () => {
    const result = checkBrandColor("burgundy");
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a colour it would have to change beyond recognition, and names the alternative", () => {
    const result = checkBrandColor("#ffd400");
    expect(result.ok).toBe(false);
    if (!result.ok && result.reason === "drift") {
      expect(result.suggestion).toMatch(/^#[0-9a-f]{6}$/);
      // The suggestion is itself acceptable — otherwise the advice is a loop.
      const followed = checkBrandColor(result.suggestion);
      expect(followed.ok, `suggestion ${result.suggestion} was itself refused`).toBe(true);
    } else {
      throw new Error(`expected a drift refusal, got ${JSON.stringify(result)}`);
    }
  });

  it("never suggests a colour that is itself refused, for any hue", () => {
    for (const hue of HUES) {
      const input = oklchToHex({ l: 0.9, c: 0.16, h: hue });
      const result = checkBrandColor(input);
      if (!result.ok && result.reason === "drift") {
        expect(checkBrandColor(result.suggestion).ok, `hue ${hue} → ${result.suggestion}`).toBe(true);
      }
    }
  });
});

describe("brandDrift", () => {
  it("is zero for a colour against itself", () => {
    expect(brandDrift("#dc1f24", "#dc1f24")).toBeCloseTo(0, 6);
  });

  it("grows with visible difference", () => {
    const near = brandDrift("#dc1f24", "#d42126");
    const far = brandDrift("#dc1f24", "#1877f2");
    expect(near).toBeLessThan(far);
    expect(near).toBeLessThan(0.05);
  });
});

describe("brandThemeCss", () => {
  it("writes nothing for the default colour", () => {
    expect(brandThemeCss(DEFAULT_BRAND_COLOR)).toBe("");
    expect(brandThemeCss("#DC1F24")).toBe("");
  });

  it("writes nothing for input that is not a colour", () => {
    expect(brandThemeCss("not a colour")).toBe("");
  });

  it("declares every token for both themes", () => {
    const css = brandThemeCss("#1877f2");
    expect(css).toContain(":root:root{");
    expect(css).toContain('[data-theme="dark"][data-theme="dark"]{');
    for (const token of BRAND_TOKENS) {
      // Once per theme.
      expect(css.match(new RegExp(`--color-${token}:`, "g"))?.length, token).toBe(2);
    }
  });

  it("contains nothing that could close the style element or start a script", () => {
    // It is interpolated into a <style> tag, so this is the injection surface.
    const css = brandThemeCss("#1877f2");
    expect(css).not.toMatch(/[<>]/);
    expect(css).toMatch(/^[-\w:{};#[\]"=.,\s]+$/);
  });
});
