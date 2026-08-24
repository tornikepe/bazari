import { describe, expect, it } from "vitest";
import {
  altOf,
  mainPhotoUrl,
  movePhoto,
  parsePhotos,
  photosFromForm,
  type Photo,
} from "@/lib/product-photos";

/**
 * A product's photos, as an ordered describable list.
 *
 * The column is JSON, so nothing about its shape is the database's promise.
 * That makes the parser the only thing standing between a hand-edited row and
 * a product page that throws, which is why it is tested rather than trusted.
 */

const photo = (url: string, altKa = "", altEn = ""): Photo => ({ url, altKa, altEn });

describe("parsePhotos", () => {
  it("reads a well-formed list", () => {
    expect(parsePhotos([{ url: "/a.png", altKa: "ა", altEn: "A" }])).toEqual([
      photo("/a.png", "ა", "A"),
    ]);
  });

  it("is an empty list for anything that is not one", () => {
    for (const value of [null, undefined, 0, "", "[]", {}]) {
      expect(parsePhotos(value)).toEqual([]);
    }
  });

  it("drops entries with no URL rather than rendering a broken image", () => {
    expect(parsePhotos([{ url: "" }, { url: "   " }, { altEn: "no url" }, { url: "/a.png" }])).toEqual([
      photo("/a.png"),
    ]);
  });

  it("treats a missing description as no description, not as a crash", () => {
    expect(parsePhotos([{ url: "/a.png", altKa: 7, altEn: null }])).toEqual([photo("/a.png")]);
  });
});

describe("altOf", () => {
  it("says what the photo shows, in the reader's language", () => {
    const p = photo("/a.png", "წითელი ჩანთა", "A red bag");
    expect(altOf(p, "en", "Bag")).toBe("A red bag");
    expect(altOf(p, "ka", "ჩანთა")).toBe("წითელი ჩანთა");
  });

  it("falls back to the product's name, never to a position", () => {
    // "Photo 3 of 7" is where this started, and it tells a listener nothing.
    expect(altOf(photo("/a.png"), "en", "Anker power bank")).toBe("Anker power bank");
    expect(altOf(undefined, "en", "Anker power bank")).toBe("Anker power bank");
  });

  it("treats whitespace as nothing written", () => {
    expect(altOf(photo("/a.png", "  ", "  "), "en", "Bag")).toBe("Bag");
  });
});

describe("mainPhotoUrl", () => {
  it("is the first one", () => {
    expect(mainPhotoUrl([photo("/a.png"), photo("/b.png")])).toBe("/a.png");
  });

  it("is the placeholder when there are none", () => {
    expect(mainPhotoUrl([])).toBe("/products/placeholder.svg");
  });
});

describe("movePhoto", () => {
  const list = [photo("/a.png"), photo("/b.png"), photo("/c.png")];

  it("swaps a photo with its neighbour", () => {
    expect(movePhoto(list, 1, -1).map((p) => p.url)).toEqual(["/b.png", "/a.png", "/c.png"]);
    expect(movePhoto(list, 1, 1).map((p) => p.url)).toEqual(["/a.png", "/c.png", "/b.png"]);
  });

  it("promoting the second photo makes it the main one", () => {
    // Which is the whole point: there is no separate "make this the main
    // photo" control, because the first one already is.
    expect(mainPhotoUrl(movePhoto(list, 1, -1))).toBe("/b.png");
  });

  it("does nothing at either end rather than wrapping around", () => {
    expect(movePhoto(list, 0, -1)).toBe(list);
    expect(movePhoto(list, 2, 1)).toBe(list);
  });

  it("does nothing for an index that is not in the list", () => {
    expect(movePhoto(list, 9, -1)).toBe(list);
    expect(movePhoto(list, -1, 1)).toBe(list);
  });
});

describe("photosFromForm", () => {
  const form = (urls: string[], ka: string[] = [], en: string[] = []) => ({
    getAll: (name: string) =>
      name === "photoUrl" ? urls : name === "photoAltKa" ? ka : en,
  });

  it("reads the three fields positionally, in the order posted", () => {
    expect(photosFromForm(form(["/a.png", "/b.png"], ["ა", "ბ"], ["A", "B"]))).toEqual([
      photo("/a.png", "ა", "A"),
      photo("/b.png", "ბ", "B"),
    ]);
  });

  it("drops a repeat rather than showing the same thumbnail twice", () => {
    expect(photosFromForm(form(["/a.png", "/a.png"])).map((p) => p.url)).toEqual(["/a.png"]);
  });

  it("ignores a blank field, which is what an empty input posts", () => {
    expect(photosFromForm(form(["", "/a.png", "  "])).map((p) => p.url)).toEqual(["/a.png"]);
  });

  it("caps the list, so a broken client cannot write an unbounded array", () => {
    const many = Array.from({ length: 30 }, (_, i) => `/p${i}.png`);
    expect(photosFromForm(form(many))).toHaveLength(8);
  });

  it("keeps each description with its own photo when one is missing", () => {
    // The arrays are read positionally, so a short alt list must not shift the
    // remaining descriptions onto the wrong pictures.
    expect(photosFromForm(form(["/a.png", "/b.png"], ["ა"], ["A"]))).toEqual([
      photo("/a.png", "ა", "A"),
      photo("/b.png", "", ""),
    ]);
  });
});
