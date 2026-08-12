import { describe, expect, it } from "vitest";
import { checkUpload, sniffImageType, MAX_BYTES } from "@/lib/image-upload";

/**
 * The upload gate, which is a security boundary and not a convenience.
 *
 * The browser's declared `type` is a claim from the client. These tests are
 * written against the bytes precisely because that is the only thing an
 * attacker cannot simply relabel.
 */

const bytes = (...values: number[]) => new Uint8Array(values);
const pad = (head: number[], length = 32) =>
  new Uint8Array([...head, ...Array.from({ length: Math.max(0, length - head.length) }, () => 0)]);

const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const AVIF = pad([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]);

describe("sniffImageType", () => {
  it("recognises the four formats it accepts", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(AVIF)).toBe("image/avif");
  });

  it("refuses anything else", () => {
    expect(sniffImageType(bytes(0x00)), "a single null byte").toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>")), "SVG").toBeNull();
    expect(sniffImageType(new TextEncoder().encode("<!doctype html>")), "HTML").toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a")), "GIF").toBeNull();
    expect(sniffImageType(pad([0x50, 0x4b, 0x03, 0x04])), "a zip").toBeNull();
  });

  // The two formats that share a container with things that are not images.
  it("does not mistake another RIFF file for WebP", () => {
    // RIFF….WAVE — a sound file, same first four bytes as a WebP.
    const wav = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(sniffImageType(wav)).toBeNull();
  });

  it("does not mistake an MP4 for AVIF", () => {
    // `ftyp` at 4 covers the whole ISO-BMFF family; the brand is what differs.
    const mp4 = pad([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(sniffImageType(mp4)).toBeNull();
  });

  it("is not fooled by a signature that appears later in the file", () => {
    const buried = pad([0x00, 0x00, 0xff, 0xd8, 0xff]);
    expect(sniffImageType(buried)).toBeNull();
  });
});

describe("checkUpload", () => {
  it("accepts a real image and names its type", () => {
    expect(checkUpload(PNG)).toEqual({ ok: true, type: "image/png" });
  });

  it("refuses an empty file", () => {
    expect(checkUpload(new Uint8Array(0))).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses a file over the limit", () => {
    const huge = new Uint8Array(MAX_BYTES + 1);
    huge.set(PNG.slice(0, 8));
    expect(checkUpload(huge)).toEqual({ ok: false, reason: "too-large" });
  });

  it("accepts one exactly on the limit", () => {
    const exact = new Uint8Array(MAX_BYTES);
    exact.set(PNG.slice(0, 8));
    expect(checkUpload(exact)).toEqual({ ok: true, type: "image/png" });
  });

  it("refuses a script wearing an image's name", () => {
    // What a `.png` that is really a script looks like on the wire. The
    // filename and the declared type are both absent here on purpose: neither
    // is consulted, which is the point.
    const script = new TextEncoder().encode('<script>alert("xss")</script>');
    expect(checkUpload(script)).toEqual({ ok: false, reason: "not-an-image" });
  });
});
