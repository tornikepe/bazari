import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * WCAG AA contrast, checked against the real token values.
 *
 * The values are parsed out of `globals.css` rather than copied here on
 * purpose: a test holding its own copy of the palette passes forever while the
 * site drifts away from it. This one fails the moment someone lightens a
 * colour past the threshold.
 *
 * It found genuine problems the first time it ran. `ink-400` — the shade the
 * site uses for its smallest labels — sat at 2.42:1 on the canvas, and every
 * status badge was nearer 3:1 than 4.5:1. In dark mode white text on the
 * primary button managed 3.61:1, because `brand-600` there is tuned to be
 * readable *as* text on a dark surface, which is the opposite of what a
 * background needs. That last one is why `--color-brand-solid` exists.
 */

const CSS = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

/**
 * Reads a token from a block of the stylesheet.
 *
 * Dark mode only overrides some tokens, so a lookup there falls back to the
 * `@theme` value — exactly what the cascade does in the browser.
 */
function tokens(): { light: Record<string, string>; dark: Record<string, string> } {
  const themeBlock = CSS.slice(CSS.indexOf("@theme {"), CSS.indexOf('[data-theme="dark"]'));
  const darkStart = CSS.indexOf('[data-theme="dark"] {');
  const darkBlock = CSS.slice(darkStart, CSS.indexOf("\n}", darkStart));

  const read = (block: string) => {
    const found: Record<string, string> = {};
    for (const [, name, value] of block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
      found[name] = value;
    }
    return found;
  };

  const light = read(themeBlock);
  return { light, dark: { ...light, ...read(darkBlock) } };
}

/* ------------------------------------------------------------------ */
/* WCAG 2.1 relative luminance                                         */
/* ------------------------------------------------------------------ */

function channels(hex: string): [number, number, number] {
  let value = hex.replace("#", "");
  if (value.length === 3) value = [...value].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/* ------------------------------------------------------------------ */
/* The pairs the app actually renders                                  */
/* ------------------------------------------------------------------ */

/** `min` is 4.5 for text (AA) and 3 for a UI component's boundary (1.4.11). */
const PAIRS: [label: string, fg: string, bg: string, min: number][] = [
  ["body text on a card", "ink-900", "surface", 4.5],
  ["body text on the page", "ink-900", "canvas", 4.5],
  ["secondary text", "ink-800", "surface", 4.5],
  ["field labels", "ink-700", "surface", 4.5],
  ["ink-600 on a card", "ink-600", "surface", 4.5],
  ["ink-600 on the page", "ink-600", "canvas", 4.5],
  ["muted text on a card", "ink-500", "surface", 4.5],
  ["muted text on the page", "ink-500", "canvas", 4.5],
  // The smallest text on the site, and the pair that was worst.
  ["faint 13px text on a card", "ink-400", "surface", 4.5],
  ["faint 13px text on the page", "ink-400", "canvas", 4.5],
  ["primary button", "brand-on-solid", "brand-solid", 4.5],
  ["primary button, hovered", "brand-on-solid", "brand-solid-hover", 4.5],
  ["the visitor's chat bubble", "brand-on-solid", "brand-solid", 4.5],
  ["brand text / links on a card", "brand-600", "surface", 4.5],
  ["brand text / links on the page", "brand-600", "canvas", 4.5],
  // Both were missing from this list and both were failing when it was
  // finally checked: the round icon chip on the account and tracking pages at
  // 4.48, and the dashboard's featured badge at 4.05 in dark mode. A pair that
  // is rendered and not listed here is a pair nothing is guarding.
  ["icon chip", "brand-600", "brand-50", 4.5],
  ["featured badge", "brand-700", "brand-50", 4.5],
  ["text on a dark panel", "panel-fg", "panel", 4.5],
  ["muted text on a dark panel", "panel-muted", "panel", 4.5],
  ["success badge", "success", "success-soft", 4.5],
  ["warning badge", "warning", "warning-soft", 4.5],
  ["danger badge", "danger", "danger-soft", 4.5],
  ["info badge", "info", "info-soft", 4.5],
  ["danger text", "danger", "surface", 4.5],
  ["success text", "success", "surface", 4.5],
  ["warning text", "warning", "surface", 4.5],
  ["info text", "info", "surface", 4.5],
  // Not `line`: a card's edge is decorative, an input's edge is the only
  // thing saying "you can type here".
  ["form field border", "field-border", "surface", 3],
];

describe.each([
  ["light", "light"],
  ["dark", "dark"],
] as const)("%s theme meets WCAG AA", (_name, key) => {
  const palette = tokens()[key];

  it.each(PAIRS)("%s", (_label, fg, bg, min) => {
    const foreground = palette[fg];
    const background = palette[bg];

    // A renamed token would otherwise silently skip its own check.
    expect(foreground, `--color-${fg} is missing from globals.css`).toBeDefined();
    expect(background, `--color-${bg} is missing from globals.css`).toBeDefined();

    expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(min);
  });
});

describe("the ink ramp stays a ramp", () => {
  it("gets darker in light mode and lighter in dark mode, without collapsing", () => {
    // Raising ink-400 to meet AA compressed the light end. It must still be a
    // sequence: two shades that render identically are one shade with extra
    // steps, and every component choosing between them becomes arbitrary.
    for (const key of ["light", "dark"] as const) {
      const palette = tokens()[key];
      const ramp = ["ink-400", "ink-500", "ink-600", "ink-700", "ink-800", "ink-900"]
        .map((name) => luminance(palette[name]!));

      for (let i = 1; i < ramp.length; i += 1) {
        const step = key === "light" ? ramp[i - 1]! - ramp[i]! : ramp[i]! - ramp[i - 1]!;
        expect(step, `ink-${(i + 3) * 100} does not step past ink-${(i + 4) * 100}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("brand-solid exists because brand-600 cannot do both jobs", () => {
  it("keeps the link shade readable ON dark, and the button shade readable UNDER white", () => {
    const dark = tokens().dark;

    // If these two were ever set to the same value, one of them would be
    // failing — this is the whole reason for the split.
    expect(contrast(dark["brand-600"]!, dark.surface!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark["brand-on-solid"]!, dark["brand-solid"]!)).toBeGreaterThanOrEqual(4.5);
    expect(dark["brand-600"]).not.toBe(dark["brand-solid"]);
  });
});
