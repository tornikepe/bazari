import { describe, expect, it } from "vitest";
import { MAX_SPECS, parseSpecs, readSpec, specsFromForm } from "@/lib/product-specs";

/**
 * The column is JSON, so what comes back from the database is `unknown`. These
 * are the shapes that can actually arrive — from an older version of the code,
 * from a migration, from someone editing a row by hand — and none of them may
 * take a product page down.
 */
describe("parseSpecs", () => {
  const row = { labelKa: "წონა", labelEn: "Weight", valueKa: "1.2 კგ", valueEn: "1.2 kg" };

  it("keeps a complete row, in order", () => {
    const second = { ...row, labelEn: "Colour", valueEn: "Black" };
    expect(parseSpecs([row, second]).map((spec) => spec.labelEn)).toEqual(["Weight", "Colour"]);
  });

  it("takes anything that is not a list as nothing", () => {
    for (const value of [null, undefined, {}, "[]", 7, true]) {
      expect(parseSpecs(value), String(value)).toEqual([]);
    }
  });

  it("drops rubbish inside the list rather than throwing", () => {
    // The whole point: one bad row must not cost the page the other four.
    expect(parseSpecs([null, "nope", 3, row, []])).toHaveLength(1);
  });

  it("needs a label and a value, in some language", () => {
    // A label with no value is a heading nobody asked for; a value with no
    // label is a number with no meaning.
    expect(parseSpecs([{ ...row, valueKa: "", valueEn: "" }])).toEqual([]);
    expect(parseSpecs([{ ...row, labelKa: "", labelEn: "" }])).toEqual([]);

    // One language on each side is enough.
    expect(parseSpecs([{ labelKa: "", labelEn: "Weight", valueKa: "1.2 კგ", valueEn: "" }])).toHaveLength(1);
  });

  it("trims, and refuses an essay", () => {
    const [spec] = parseSpecs([{ ...row, valueEn: `  ${"x".repeat(400)}  ` }]);
    expect(spec!.valueEn.length).toBe(120);
  });

  it("stops at the cap", () => {
    expect(parseSpecs(Array.from({ length: MAX_SPECS + 5 }, () => row))).toHaveLength(MAX_SPECS);
  });
});

describe("readSpec", () => {
  it("reads the language asked for", () => {
    const spec = { labelKa: "წონა", labelEn: "Weight", valueKa: "1.2 კგ", valueEn: "1.2 kg" };
    expect(readSpec(spec, "ka")).toEqual({ label: "წონა", value: "1.2 კგ" });
    expect(readSpec(spec, "en")).toEqual({ label: "Weight", value: "1.2 kg" });
  });

  it("falls back rather than showing a hole", () => {
    // A shop that filled in only English has said something true, and hiding
    // it from a Georgian reader helps nobody.
    const half = { labelKa: "", labelEn: "Weight", valueKa: "", valueEn: "1.2 kg" };
    expect(readSpec(half, "ka")).toEqual({ label: "Weight", value: "1.2 kg" });
  });
});

describe("specsFromForm", () => {
  /** What a set of repeated inputs posts: four parallel lists. */
  const form = (columns: Record<string, string[]>) => ({
    getAll: (name: string) => columns[name] ?? [],
  });

  it("zips the four columns back into rows", () => {
    const rows = specsFromForm(
      form({
        spec_labelKa: ["წონა", "ფერი"],
        spec_labelEn: ["Weight", "Colour"],
        spec_valueKa: ["1.2 კგ", "შავი"],
        spec_valueEn: ["1.2 kg", "Black"],
      }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      labelKa: "ფერი",
      labelEn: "Colour",
      valueKa: "შავი",
      valueEn: "Black",
    });
  });

  it("drops a row the reader left blank", () => {
    // Adding a row and then changing your mind is normal; it must not store an
    // empty line the product page would have to skip.
    const rows = specsFromForm(
      form({
        spec_labelKa: ["წონა", ""],
        spec_labelEn: ["Weight", ""],
        spec_valueKa: ["1.2 კგ", ""],
        spec_valueEn: ["1.2 kg", ""],
      }),
    );
    expect(rows).toHaveLength(1);
  });

  it("survives columns of different lengths", () => {
    // Not hypothetical: a hand-crafted POST, or a field renamed on one input.
    const rows = specsFromForm(form({ spec_labelEn: ["Weight"], spec_valueEn: ["1.2 kg", "spare"] }));
    expect(rows).toHaveLength(1);
  });

  it("takes an empty form as no specifications", () => {
    expect(specsFromForm(form({}))).toEqual([]);
  });
});
