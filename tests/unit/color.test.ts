import { describe, it, expect } from "vitest";
import {
  parseHex,
  toHex,
  contrastHex,
  rgbToOklch,
  oklchToHex,
  hexToOklch,
  solveForContrast,
  relativeLuminance,
} from "@/lib/color";

describe("parseHex", () => {
  it("reads both lengths, with or without the hash", () => {
    expect(parseHex("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHex("000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHex("#f00")).toEqual({ r: 1, g: 0, b: 0 });
  });

  it("refuses anything that is not a colour", () => {
    for (const bad of ["", "#", "#ff", "#fffff", "#gggggg", "red", "rgb(1,2,3)", "#ffffff ff"]) {
      expect(parseHex(bad), bad).toBeNull();
    }
  });

  it("round-trips through hex", () => {
    for (const hex of ["#dc1f24", "#14171d", "#f4f5f7", "#00ff88"]) {
      expect(toHex(parseHex(hex)!)).toBe(hex);
    }
  });
});

describe("contrast", () => {
  // The two anchors of the WCAG scale — if these are wrong, everything is.
  it("is 21 for black on white and 1 for a colour on itself", () => {
    expect(contrastHex("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastHex("#dc1f24", "#dc1f24")).toBeCloseTo(1, 5);
  });

  it("does not care which way round the arguments go", () => {
    expect(contrastHex("#dc1f24", "#ffffff")).toBeCloseTo(contrastHex("#ffffff", "#dc1f24"), 10);
  });

  // Published sRGB luminances.
  it("computes the standard luminances", () => {
    expect(relativeLuminance(parseHex("#ffffff")!)).toBeCloseTo(1, 6);
    expect(relativeLuminance(parseHex("#000000")!)).toBeCloseTo(0, 6);
    expect(relativeLuminance(parseHex("#808080")!)).toBeCloseTo(0.2159, 3);
  });

  // The ratios recorded beside the ink ramp in globals.css. Two of those
  // comments were out by ~0.1 when this was first run against them and have
  // been corrected — the numbers here are the computed truth, checked by hand
  // for ink-500: luminance 0.1322 against the canvas's 0.9125 is 5.28, not the
  // 5.38 that was written down.
  it("agrees with the ratios recorded against the ink ramp", () => {
    expect(contrastHex("#6a707d", "#f4f5f7")).toBeCloseTo(4.55, 2);
    expect(contrastHex("#5f6675", "#f4f5f7")).toBeCloseTo(5.28, 2);
    expect(contrastHex("#4d5567", "#f4f5f7")).toBeCloseTo(6.85, 2);
  });

  it("agrees that the brand button clears AA in both themes", () => {
    expect(contrastHex("#ffffff", "#dc1f24")).toBeGreaterThanOrEqual(4.5);
    expect(contrastHex("#ffffff", "#d34246")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("OKLCH", () => {
  it("round-trips every channel of a spread of colours", () => {
    for (const hex of ["#dc1f24", "#00ff00", "#0000ff", "#ffffff", "#000000", "#7f7f7f", "#f4f5f7"]) {
      expect(oklchToHex(hexToOklch(hex)!), hex).toBe(hex);
    }
  });

  it("puts white and black at the ends of the lightness axis", () => {
    expect(rgbToOklch(parseHex("#ffffff")!).l).toBeCloseTo(1, 3);
    expect(rgbToOklch(parseHex("#000000")!).l).toBeCloseTo(0, 3);
  });

  it("reports grey as having no chroma, and a hue near zero", () => {
    const grey = rgbToOklch(parseHex("#808080")!);
    expect(grey.c).toBeLessThan(0.002);
  });

  it("keeps hue when only lightness moves", () => {
    const base = hexToOklch("#dc1f24")!;
    const lighter = { ...base, l: base.l + 0.2 };
    const back = hexToOklch(oklchToHex(lighter))!;
    expect(back.h).toBeCloseTo(base.h, 0);
  });

  // The reason chroma is reduced rather than channels clamped.
  it("holds the hue of an out-of-gamut request instead of skewing it", () => {
    // Vivid blue at a lightness sRGB cannot reach at that chroma.
    const asked = { l: 0.95, c: 0.3, h: 264 };
    const got = hexToOklch(oklchToHex(asked))!;
    expect(Math.abs(got.h - asked.h)).toBeLessThan(2);
    expect(got.c).toBeLessThan(asked.c);
  });
});

describe("solveForContrast", () => {
  const canvas = parseHex("#f4f5f7")!;
  const white = parseHex("#ffffff")!;
  const darkSurface = parseHex("#14171d")!;

  it("leaves a colour that already passes exactly where it is", () => {
    const passes = hexToOklch("#dc1f24")!;
    expect(solveForContrast(passes, white, 4.5, "darker")).toEqual(passes);
  });

  it("darkens a colour that fails until it passes, and no further", () => {
    // A mid yellow: nowhere near 4.5:1 on a light canvas.
    const yellow = hexToOklch("#ffd400")!;
    expect(contrastHex("#ffd400", "#f4f5f7")).toBeLessThan(4.5);

    const fixed = solveForContrast(yellow, canvas, 4.5, "darker");
    const ratio = contrastHex(oklchToHex(fixed), "#f4f5f7");

    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Nearest passing value, not an overshoot to black.
    expect(ratio).toBeLessThan(4.9);
    expect(fixed.l).toBeLessThan(yellow.l);
  });

  it("lightens when asked to go the other way", () => {
    const deepBlue = hexToOklch("#12206b")!;
    const fixed = solveForContrast(deepBlue, darkSurface, 4.5, "lighter");

    expect(contrastHex(oklchToHex(fixed), "#14171d")).toBeGreaterThanOrEqual(4.5);
    expect(fixed.l).toBeGreaterThan(deepBlue.l);
  });

  it("keeps the hue it was given while moving lightness", () => {
    const green = hexToOklch("#00c853")!;
    const fixed = solveForContrast(green, canvas, 4.5, "darker");
    expect(Math.abs(fixed.h - green.h)).toBeLessThan(0.001);
  });

  it("returns the extreme rather than throwing when the target is unreachable", () => {
    // Nothing reaches 21:1 against a mid grey.
    const anything = hexToOklch("#dc1f24")!;
    const fixed = solveForContrast(anything, parseHex("#808080")!, 21, "darker");
    expect(fixed.l).toBe(0);
  });

  it("reaches AA from any hue on the light canvas", () => {
    for (let hue = 0; hue < 360; hue += 15) {
      const start = { l: 0.75, c: 0.18, h: hue };
      const fixed = solveForContrast(start, canvas, 4.5, "darker");
      expect(contrastHex(oklchToHex(fixed), "#f4f5f7"), `hue ${hue}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
