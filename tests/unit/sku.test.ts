import { describe, expect, it } from "vitest";
import { generateSku, skuCandidate } from "@/lib/sku";

describe("skuCandidate", () => {
  it("takes three latin letters from the category", () => {
    expect(skuCandidate("phones")).toMatch(/^PHO-[A-Z2-9]{5}$/);
    expect(skuCandidate("home-garden")).toMatch(/^HOM-/);
  });

  it("pads a short category rather than producing a ragged prefix", () => {
    expect(skuCandidate("tv")).toMatch(/^TVX-/);
    expect(skuCandidate("")).toMatch(/^XXX-/);
  });

  it("survives a category with no latin letters at all", () => {
    // Slugs are latin by construction, but nothing in the type system says so,
    // and a Georgian name reaching here must not yield "-XXXXX".
    expect(skuCandidate("ტელეფონები")).toMatch(/^XXX-[A-Z2-9]{5}$/);
  });

  it("omits the characters people mis-read off a label", () => {
    // I/O/0/1 are the pairs that get copied wrong in a warehouse. Enough
    // samples that their absence is the alphabet, not luck.
    const codes = Array.from({ length: 400 }, () => skuCandidate("phones").split("-")[1]);
    expect(codes.join("")).not.toMatch(/[IO01]/);
  });

  it("is random, not a sequence", () => {
    const codes = new Set(Array.from({ length: 200 }, () => skuCandidate("phones")));
    expect(codes.size).toBeGreaterThan(190);
  });
});

describe("generateSku", () => {
  it("returns the first code that is free", async () => {
    const sku = await generateSku("phones", async () => false);
    expect(sku).toMatch(/^PHO-[A-Z2-9]{5}$/);
  });

  it("retries past a collision", async () => {
    let calls = 0;
    const sku = await generateSku("phones", async () => ++calls < 3);
    expect(sku).not.toBeNull();
    expect(calls).toBe(3);
  });

  it("gives up rather than looping forever", async () => {
    let calls = 0;
    const sku = await generateSku(
      "phones",
      async () => {
        calls++;
        return true;
      },
      4,
    );
    // Null is a real outcome the caller has to handle — the alternative is an
    // unbounded loop against a database, which is worse than a failed save.
    expect(sku).toBeNull();
    expect(calls).toBe(4);
  });
});
