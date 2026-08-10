/**
 * Builds the brand half of the palette from one colour the shop owner picks.
 *
 * The site has ten brand shades plus three solid-button tokens, in two themes.
 * Nobody is going to choose sixteen colours, and nobody should have to: what a
 * business has is *one* colour, off a logo. So one colour is the input, and the
 * rest is derived.
 *
 * ## What is kept from the picked colour, and what is not
 *
 * Hue and chroma are kept. Lightness is not — it comes from the default ramp,
 * which was tuned shade by shade against every pair the site actually renders.
 * Reusing that profile means a new brand inherits work already done rather than
 * a fresh set of guesses.
 *
 * That trade is the whole design. A colour picked off a logo is chosen to look
 * right on a sign or a package, where nothing has to be legible *on* it at
 * 13px. The same colour as link text on a near-white page is a different
 * question, and for light colours the honest answer is that it cannot be used
 * unchanged.
 *
 * ## Why derived is still not trusted
 *
 * Equal lightness in OKLCH is not equal luminance in WCAG — a yellow and a blue
 * at the same L differ threefold — so a ramp that looks correctly stepped can
 * still fail AA. Every shade is therefore *measured* after derivation and moved
 * until it passes. `auditBrandTheme` then re-checks the finished palette against
 * the same pair list the static tokens are held to, and that audit is what the
 * save path believes — not the derivation that produced it.
 */
import {
  contrastRatio,
  hexToOklch,
  oklchToHex,
  parseHex,
  quantise,
  oklchToGamutRgb,
  solveForContrast,
  type Oklch,
  type Rgb,
} from "./color";

export const BRAND_TOKENS = [
  "brand-50",
  "brand-100",
  "brand-200",
  "brand-300",
  "brand-400",
  "brand-500",
  "brand-600",
  "brand-700",
  "brand-800",
  "brand-900",
  "brand-solid",
  "brand-solid-hover",
  "brand-on-solid",
] as const;

export type BrandToken = (typeof BRAND_TOKENS)[number];
export type BrandRamp = Record<BrandToken, string>;
export type BrandTheme = { light: BrandRamp; dark: BrandRamp };

/** The shop's own red, and the shape every derived ramp is cut from. */
export const DEFAULT_BRAND_COLOR = "#dc1f24";

/**
 * The default palette, copied from `globals.css`.
 *
 * A test parses the stylesheet and asserts these still match, so the copy
 * cannot quietly drift from the source it was taken from.
 */
const TEMPLATE_LIGHT: BrandRamp = {
  "brand-50": "#fff5f5",
  "brand-100": "#ffdfdf",
  "brand-200": "#ffc5c5",
  "brand-300": "#ff9d9d",
  "brand-400": "#fb6565",
  "brand-500": "#f23b3b",
  "brand-600": "#dc1f24",
  "brand-700": "#bb161c",
  "brand-800": "#9a161b",
  "brand-900": "#80191d",
  "brand-solid": "#dc1f24",
  "brand-solid-hover": "#bb161c",
  "brand-on-solid": "#ffffff",
};

/** Dark mode overrides only these; the rest of the ramp is inherited. */
const TEMPLATE_DARK: BrandRamp = {
  ...TEMPLATE_LIGHT,
  "brand-50": "#2a1417",
  "brand-100": "#3d1a1e",
  "brand-600": "#f04b4f",
  "brand-700": "#ff6060",
  "brand-solid": "#d34246",
  "brand-solid-hover": "#c4262b",
};

/** The surfaces brand colours are read against, per theme, from `globals.css`. */
const GROUND = {
  light: { surface: "#ffffff", canvas: "#f4f5f7", ink: "#161a23" },
  dark: { surface: "#14171d", canvas: "#0d0f13", ink: "#f4f6fa" },
} as const;

export type Theme = keyof typeof GROUND;

/**
 * Every pair of brand tokens the site puts on top of each other.
 *
 * Taken from real markup, not from what the ramp suggests: `brand-700` on
 * `brand-50` is the "featured" badge in the dashboard, and `brand-600` on
 * `brand-50` is the round icon chip on the account and order-tracking pages.
 * A pair nobody renders does not belong here, and a pair that is rendered and
 * missing is a hole in the guarantee.
 */
export type BrandPairKey = "button" | "buttonHover" | "linkCard" | "linkPage" | "chip" | "badge";

export const BRAND_PAIRS: {
  /** Names the pair for the interface, which is bilingual; `label` is not. */
  key: BrandPairKey;
  /** English, for test failures and server logs — never rendered to a shop owner. */
  label: string;
  fg: BrandToken;
  bg: BrandToken | "surface" | "canvas";
}[] = [
  { key: "button", label: "primary button", fg: "brand-on-solid", bg: "brand-solid" },
  { key: "buttonHover", label: "primary button, hovered", fg: "brand-on-solid", bg: "brand-solid-hover" },
  { key: "linkCard", label: "links on a card", fg: "brand-600", bg: "surface" },
  { key: "linkPage", label: "links on the page", fg: "brand-600", bg: "canvas" },
  { key: "chip", label: "icon chip", fg: "brand-600", bg: "brand-50" },
  { key: "badge", label: "featured badge", fg: "brand-700", bg: "brand-50" },
];

export const AA_TEXT = 4.5;

const resolve = (ramp: BrandRamp, theme: Theme, name: string): string =>
  name === "surface" || name === "canvas" ? GROUND[theme][name] : ramp[name as BrandToken];

/**
 * Re-hues one shade: the picked colour's hue and relative saturation, at the
 * template shade's lightness.
 */
function reHue(templateHex: string, picked: Oklch, chromaScale: number): Oklch {
  const template = hexToOklch(templateHex);
  if (!template) throw new Error(`brand template is not a colour: ${templateHex}`);
  return { l: template.l, c: template.c * chromaScale, h: picked.h };
}

/**
 * White or near-black on the button, whichever is more readable.
 *
 * Fixing this to white is what forces a yellow or lime brand to be darkened
 * into something else before its own button works. Letting it flip costs
 * nothing on a dark brand — red keeps white text, as it always had — and it
 * means a light brand stays the colour it was picked as.
 */
function pickOnSolid(solid: Rgb, theme: Theme): string {
  const white = parseHex("#ffffff")!;
  const ink = parseHex(GROUND[theme].ink)!;
  return contrastRatio(white, solid) >= contrastRatio(ink, solid) ? "#ffffff" : GROUND[theme].ink;
}

function deriveRamp(picked: Oklch, theme: Theme): BrandRamp {
  const template = theme === "light" ? TEMPLATE_LIGHT : TEMPLATE_DARK;

  const templateAnchor = hexToOklch(template["brand-600"])!;
  // Saturation is carried across as a ratio, so a muted brand stays muted along
  // the whole ramp and a vivid one stays vivid, rather than every shop landing
  // on the same intensity.
  const chromaScale = templateAnchor.c > 0 ? picked.c / templateAnchor.c : 0;

  const surface = parseHex(GROUND[theme].surface)!;
  const canvas = parseHex(GROUND[theme].canvas)!;
  // Text darkens against a light ground and lightens against a dark one.
  const away = theme === "light" ? ("darker" as const) : ("lighter" as const);

  const shade = (name: BrandToken) => reHue(template[name], picked, chromaScale);

  // The tints first: they are backgrounds, so they are not solved against
  // anything — but the shades that sit on them are.
  const tint50 = shade("brand-50");
  const tint50Rgb = quantise(oklchToGamutRgb(tint50));

  // Links must clear AA on all three grounds they appear on. Solving against
  // the hardest of them once is the same as solving three times.
  let link = shade("brand-600");
  for (const ground of [surface, canvas, tint50Rgb]) {
    link = solveForContrast(link, ground, AA_TEXT, away);
  }

  // The hover shade is a step further from the ground than the link, and has
  // the badge tint to clear as well.
  let hover = shade("brand-700");
  for (const ground of [surface, canvas, tint50Rgb]) {
    hover = solveForContrast(hover, ground, AA_TEXT, away);
  }

  // The button: choose its text first, then darken or lighten the background
  // only if even the better text colour cannot read on it.
  const solidBase = shade("brand-solid");
  const onSolid = pickOnSolid(quantise(oklchToGamutRgb(solidBase)), theme);
  const onSolidRgb = parseHex(onSolid)!;
  const solid = solveForContrast(solidBase, onSolidRgb, AA_TEXT, onSolid === "#ffffff" ? "darker" : "lighter");
  const solidHover = solveForContrast(
    shade("brand-solid-hover"),
    onSolidRgb,
    AA_TEXT,
    onSolid === "#ffffff" ? "darker" : "lighter",
  );

  return {
    "brand-50": oklchToHex(tint50),
    "brand-100": oklchToHex(shade("brand-100")),
    "brand-200": oklchToHex(shade("brand-200")),
    "brand-300": oklchToHex(shade("brand-300")),
    "brand-400": oklchToHex(shade("brand-400")),
    "brand-500": oklchToHex(shade("brand-500")),
    "brand-600": oklchToHex(link),
    "brand-700": oklchToHex(hover),
    "brand-800": oklchToHex(shade("brand-800")),
    "brand-900": oklchToHex(shade("brand-900")),
    "brand-solid": oklchToHex(solid),
    "brand-solid-hover": oklchToHex(solidHover),
    "brand-on-solid": onSolid,
  };
}

/**
 * The full brand palette for both themes.
 *
 * Returns the untouched default for the default colour, so a shop that never
 * sets one renders byte-identically to the stylesheet.
 */
export function deriveBrandTheme(hex: string): BrandTheme | null {
  const picked = hexToOklch(hex);
  if (!picked) return null;

  if (hex.toLowerCase() === DEFAULT_BRAND_COLOR) {
    return { light: { ...TEMPLATE_LIGHT }, dark: { ...TEMPLATE_DARK } };
  }

  return { light: deriveRamp(picked, "light"), dark: deriveRamp(picked, "dark") };
}

export type AuditRow = {
  theme: Theme;
  key: BrandPairKey;
  label: string;
  fg: string;
  bg: string;
  ratio: number;
  passes: boolean;
};

/** Measures the finished palette against every pair the site renders. */
export function auditBrandTheme(theme: BrandTheme): AuditRow[] {
  const rows: AuditRow[] = [];

  for (const name of ["light", "dark"] as const) {
    const ramp = theme[name];
    for (const pair of BRAND_PAIRS) {
      const fg = resolve(ramp, name, pair.fg);
      const bg = resolve(ramp, name, pair.bg);
      const ratio = contrastRatio(parseHex(fg)!, parseHex(bg)!);
      rows.push({ theme: name, key: pair.key, label: pair.label, fg, bg, ratio, passes: ratio >= AA_TEXT });
    }
  }

  return rows;
}

/**
 * How far the site's link shade ended up from the colour that was asked for,
 * as a perceptual distance in OKLab.
 *
 * Roughly: below 0.02 is indistinguishable, 0.05 is a noticeable difference of
 * shade, and past 0.12 it reads as a different colour.
 */
export function brandDrift(hex: string, derived: string): number {
  const a = hexToOklch(hex);
  const b = hexToOklch(derived);
  if (!a || !b) return Infinity;

  const toLab = ({ l, c, h }: Oklch) => {
    const rad = (h * Math.PI) / 180;
    return { l, a: c * Math.cos(rad), b: c * Math.sin(rad) };
  };
  const p = toLab(a);
  const q = toLab(b);
  return Math.sqrt((p.l - q.l) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2);
}

/**
 * Past this, the colour on screen is not the colour that was chosen, and saying
 * so is better than quietly using it.
 */
export const DRIFT_LIMIT = 0.12;

export type BrandCheck =
  | { ok: true; theme: BrandTheme; audit: AuditRow[]; drift: number }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "unusable"; failing: AuditRow[] }
  | { ok: false; reason: "drift"; drift: number; suggestion: string; theme: BrandTheme };

/**
 * Decides whether a picked colour can be the shop's brand.
 *
 * Three answers rather than two, because "no" has two different meanings and
 * they need different words in front of the owner:
 *
 *  - `invalid` — not a colour at all.
 *  - `unusable` — derived, measured, and some pair still cannot reach AA. This
 *    should not happen for any real hue and is kept because the audit, not the
 *    derivation, is the authority; if it ever fires, the derivation has a bug
 *    and the save must not go through on trust.
 *  - `drift` — it works, but only after moving far enough that the site would
 *    no longer be showing the chosen colour. The nearest colour that *is* usable
 *    comes back with it, so the answer is a choice rather than a rejection.
 */
export function checkBrandColor(hex: string): BrandCheck {
  const theme = deriveBrandTheme(hex);
  if (!theme) return { ok: false, reason: "invalid" };

  const audit = auditBrandTheme(theme);
  const failing = audit.filter((row) => !row.passes);
  if (failing.length > 0) return { ok: false, reason: "unusable", failing };

  // Measured on the light theme's link shade: it is the most exposed use of the
  // brand colour and the one a person compares against their logo.
  const drift = brandDrift(hex, theme.light["brand-600"]);
  if (drift > DRIFT_LIMIT) {
    return { ok: false, reason: "drift", drift, suggestion: theme.light["brand-600"], theme };
  }

  return { ok: true, theme, audit, drift };
}

/**
 * The palette as CSS, for a `<style>` element in the document head.
 *
 * Written as custom properties on `:root` and `[data-theme="dark"]`, the same
 * two places the stylesheet defines them, so this overrides the defaults
 * through ordinary cascade order rather than by fighting specificity.
 *
 * Returns an empty string for the default colour: no element, nothing to
 * override, and the stylesheet stands on its own.
 */
export function brandThemeCss(hex: string): string {
  if (hex.toLowerCase() === DEFAULT_BRAND_COLOR) return "";

  const theme = deriveBrandTheme(hex);
  if (!theme) return "";

  const block = (selector: string, ramp: BrandRamp) =>
    `${selector}{${BRAND_TOKENS.map((token) => `--color-${token}:${ramp[token]}`).join(";")}}`;

  // The selectors are doubled on purpose. Tailwind's `@theme` compiles to a
  // plain `:root`, which is exactly the specificity this would otherwise have,
  // leaving the winner decided by whichever stylesheet the framework happens to
  // put later in the document — not something to build a palette on. Repeating
  // the selector raises specificity without changing what it matches, so this
  // wins wherever it lands.
  return `${block(":root:root", theme.light)}${block('[data-theme="dark"][data-theme="dark"]', theme.dark)}`;
}
