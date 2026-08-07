import { describe, expect, it } from "vitest";
import { parseSections, serialiseSections, substitute } from "@/lib/info-content";

const values = {
  freeShippingThreshold: "200,00 ₾",
  shippingFee: "15,00 ₾",
  shopName: "Bazari",
};

describe("parseSections", () => {
  it("splits on headings", () => {
    const parsed = parseSections("## First\nalpha\n\n## Second\nbeta", values);
    expect(parsed).toEqual([
      { heading: "First", body: ["alpha"] },
      { heading: "Second", body: ["beta"] },
    ]);
  });

  it("keeps paragraphs written before any heading", () => {
    // The first thing an owner types is a sentence, not a heading. It has to
    // land somewhere rather than being silently dropped.
    const parsed = parseSections("just a sentence\n\n## Later\nmore", values);
    expect(parsed[0]).toEqual({ heading: "", body: ["just a sentence"] });
    expect(parsed[1].heading).toBe("Later");
  });

  it("treats blank lines as separators, not content", () => {
    const parsed = parseSections("## H\n\n\none\n\n\n\ntwo\n\n", values);
    expect(parsed).toEqual([{ heading: "H", body: ["one", "two"] }]);
  });

  it("returns nothing for an empty page", () => {
    // An empty page is hidden from the footer rather than rendered blank, and
    // this is what that check reads.
    expect(parseSections("", values)).toEqual([]);
    expect(parseSections("   \n\n  ", values)).toEqual([]);
  });

  it("ignores a lone hash — only `## ` starts a section", () => {
    const parsed = parseSections("#not a heading\n##also not", values);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].heading).toBe("");
    expect(parsed[0].body).toEqual(["#not a heading", "##also not"]);
  });
});

describe("substitute", () => {
  it("resolves the shipping figures", () => {
    expect(substitute("free over {freeShipping}, else {shippingFee}", values)).toBe(
      "free over 200,00 ₾, else 15,00 ₾",
    );
  });

  it("replaces every occurrence, not just the first", () => {
    expect(substitute("{shopName} — {shopName}", values)).toBe("Bazari — Bazari");
  });

  it("leaves unknown braces alone", () => {
    // Owners will type braces for other reasons; eating them would be worse
    // than ignoring them.
    expect(substitute("a {mystery} thing", values)).toBe("a {mystery} thing");
  });

  it("runs inside parsed sections, not only on raw text", () => {
    const parsed = parseSections("## Cost\nFree over {freeShipping}.", values);
    expect(parsed[0].body[0]).toBe("Free over 200,00 ₾.");
  });
});

describe("serialiseSections", () => {
  it("round-trips", () => {
    // The seed writes the repo's text into the table through this, so a lossy
    // conversion would quietly rewrite every page on first run.
    const sections = [
      { heading: "One", body: ["a", "b"] },
      { heading: "Two", body: ["c"] },
    ];
    expect(parseSections(serialiseSections(sections), values)).toEqual(sections);
  });

  it("round-trips a headless opening section", () => {
    const sections = [{ heading: "", body: ["intro line"] }];
    expect(parseSections(serialiseSections(sections), values)).toEqual(sections);
  });
});
