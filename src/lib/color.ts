/**
 * Colour maths: sRGB ↔ OKLCH, and WCAG contrast.
 *
 * Two different jobs need two different colour spaces, and using one for both
 * is where colour code usually goes wrong.
 *
 * WCAG contrast is defined on relative luminance, which is a *physical*
 * measure — it is what the standard requires and the only thing that decides
 * whether text passes. But luminance is useless for building a colour ramp:
 * interpolating in sRGB drags saturated colours through grey, and equal steps
 * in luminance do not look like equal steps.
 *
 * OKLCH is perceptual — its L is roughly how light a colour *looks*, and its
 * hue stays put when lightness changes, which is exactly what a tint ramp
 * needs. So the ramp is built in OKLCH and then judged by WCAG luminance. The
 * two never agree numerically: a yellow and a blue at the same OKLCH lightness
 * differ by a factor of three in luminance, which is precisely why a ramp that
 * looks even can still fail AA and has to be measured rather than assumed.
 */

export type Rgb = { r: number; g: number; b: number };
/** L 0–1, C 0–~0.4, H degrees 0–360. */
export type Oklch = { l: number; c: number; h: number };

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

// --- hex ---------------------------------------------------------------

/** Accepts `#abc` and `#aabbcc`, with or without the hash. Null if it isn't one. */
export function parseHex(input: string): Rgb | null {
  const raw = input.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.replace(/./g, (ch) => ch + ch) : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255,
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (n: number) =>
    Math.round(clamp01(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

// --- WCAG --------------------------------------------------------------

/** The sRGB transfer function, undone. WCAG 2.x defines it with this exact curve. */
const linearise = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const gammaEncode = (channel: number) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * WCAG contrast ratio, 1–21. Order of arguments does not matter.
 *
 * AA wants 4.5 for body text and 3 for large text and for the boundary of a
 * control. This project holds text to 4.5 everywhere.
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Same, for two hex strings. Throws on input that is not a colour. */
export function contrastHex(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) throw new Error(`contrastHex: not a colour: ${!ca ? a : b}`);
  return contrastRatio(ca, cb);
}

// --- OKLab / OKLCH -----------------------------------------------------
// Björn Ottosson's matrices. Kept as literals rather than folded into
// constants: they are a published specification, and a "tidied" matrix is a
// silently wrong one.

export function rgbToOklch(rgb: Rgb): Oklch {
  const r = linearise(rgb.r);
  const g = linearise(rgb.g);
  const b = linearise(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.sqrt(a * a + bb * bb);
  // atan2 returns −180…180; hue is conventionally 0…360.
  const hue = chroma < 1e-7 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;

  return { l: lightness, c: chroma, h: hue };
}

/** May land outside sRGB — `oklchToHex` is the one that guarantees a real colour. */
export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: gammaEncode(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    g: gammaEncode(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    b: gammaEncode(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  };
}

const IN_GAMUT_EPSILON = 1 / 512;

function inGamut({ r, g, b }: Rgb): boolean {
  return [r, g, b].every((channel) => channel >= -IN_GAMUT_EPSILON && channel <= 1 + IN_GAMUT_EPSILON);
}

/**
 * OKLCH to a real sRGB colour, reducing chroma until it fits.
 *
 * Most of the OKLCH space has no sRGB equivalent — ask for a vivid colour at a
 * very high or very low lightness and the conversion returns channels outside
 * 0–1. Clamping those channels is the obvious fix and the wrong one: it shifts
 * the hue, so a ramp built that way drifts colour at its ends. Pulling chroma
 * in instead keeps the hue exactly and desaturates, which is what the eye
 * expects a near-white or near-black tint to do anyway.
 */
export function oklchToGamutRgb(colour: Oklch): Rgb {
  const direct = oklchToRgb(colour);
  if (inGamut(direct)) return direct;

  let fits = 0;
  let spills = colour.c;
  // 20 halvings resolve chroma far finer than an 8-bit channel can show.
  for (let i = 0; i < 20; i++) {
    const mid = (fits + spills) / 2;
    if (inGamut(oklchToRgb({ ...colour, c: mid }))) fits = mid;
    else spills = mid;
  }
  return oklchToRgb({ ...colour, c: fits });
}

export const oklchToHex = (colour: Oklch): string => toHex(oklchToGamutRgb(colour));

/**
 * Rounds to the 8 bits per channel a hex colour actually has.
 *
 * Anything that judges a colour has to judge the quantised one. Solving for
 * contrast against the continuous value and then writing the rounded hex
 * produced shades measuring 4.490:1 against a 4.5 target — passing in the
 * solver, failing in the browser, by a rounding step the solver never saw.
 */
export const quantise = ({ r, g, b }: Rgb): Rgb => ({
  r: Math.round(clamp01(r) * 255) / 255,
  g: Math.round(clamp01(g) * 255) / 255,
  b: Math.round(clamp01(b) * 255) / 255,
});

export const hexToOklch = (hex: string): Oklch | null => {
  const rgb = parseHex(hex);
  return rgb ? rgbToOklch(rgb) : null;
};

/**
 * The nearest colour to `colour` that reaches `target` contrast against
 * `against`, moving lightness in one direction only.
 *
 * One direction, because the caller always knows which way it means: text on a
 * light background can only be fixed by darkening, and darkening a link until
 * it passes keeps it recognisably the same colour. Searching both directions
 * would let a dark blue "pass" by turning into a pale blue, which is a
 * different design.
 *
 * Returns the input untouched when it already passes, so a colour that needs no
 * help is never nudged.
 */
export function solveForContrast(
  colour: Oklch,
  against: Rgb,
  target: number,
  direction: "darker" | "lighter",
): Oklch {
  const ratioAt = (l: number) => contrastRatio(quantise(oklchToGamutRgb({ ...colour, l })), against);

  if (ratioAt(colour.l) >= target) return colour;

  // The extreme in the chosen direction. If even black (or white) cannot reach
  // the target, nothing can, and the caller gets the closest attempt rather
  // than an exception — the audit is what reports the failure.
  const limit = direction === "darker" ? 0 : 1;
  if (ratioAt(limit) < target) return { ...colour, l: limit };

  // Converge from the failing lightness towards the one known to pass, keeping
  // `passes` as the closest value proven to clear the target.
  let fails = colour.l;
  let passes = limit;
  for (let i = 0; i < 24; i++) {
    const mid = (fails + passes) / 2;
    if (ratioAt(mid) >= target) passes = mid;
    else fails = mid;
  }
  return { ...colour, l: passes };
}
