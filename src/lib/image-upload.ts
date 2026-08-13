/**
 * What counts as an image, decided by looking at the bytes.
 *
 * The browser sends a `type` on every uploaded file and it is a claim, not a
 * fact: it comes from the client and can say anything. A file named `.png`
 * carrying a script is still a script, and a route that stores whatever the
 * form declared and serves it back with that `Content-Type` is how a stored
 * cross-site scripting bug gets built.
 *
 * So the type is read from the file's own leading bytes and the declaration is
 * discarded. If the two disagree, the bytes win — and if the bytes are not one
 * of these four formats, nothing is stored at all.
 */

export const MAX_BYTES = 2 * 1024 * 1024;

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/avif";

/** File signatures, long enough to be unambiguous. */
const SIGNATURES: { type: ImageType; offset: number; bytes: number[] }[] = [
  { type: "image/jpeg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // RIFF….WEBP — the four bytes at 8 are what separate WebP from other RIFF
  // containers, so both halves are checked.
  { type: "image/webp", offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { type: "image/avif", offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
];

const matches = (view: Uint8Array, offset: number, bytes: number[]) =>
  bytes.every((byte, index) => view[offset + index] === byte);

/**
 * The image type these bytes actually are, or null.
 *
 * Null is a refusal, not a fallback: a caller that cannot name the format has
 * no business storing the file.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  for (const signature of SIGNATURES) {
    if (!matches(bytes, signature.offset, signature.bytes)) continue;

    if (signature.type === "image/webp") {
      // RIFF alone is a container; WEBP at byte 8 is what makes it an image.
      if (!matches(bytes, 8, [0x57, 0x45, 0x42, 0x50])) continue;
      return "image/webp";
    }

    if (signature.type === "image/avif") {
      // `ftyp` at 4 covers the whole ISO-BMFF family — MP4 included — so the
      // brand that follows has to say AVIF.
      const brand = String.fromCharCode(...bytes.slice(8, 12));
      if (brand !== "avif" && brand !== "avis") continue;
      return "image/avif";
    }

    return signature.type;
  }

  return null;
}

export type UploadRefusal = "empty" | "too-large" | "not-an-image";

export function checkUpload(bytes: Uint8Array): { ok: true; type: ImageType } | { ok: false; reason: UploadRefusal } {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, reason: "too-large" };

  const type = sniffImageType(bytes);
  if (!type) return { ok: false, reason: "not-an-image" };

  return { ok: true, type };
}

/**
 * As many photos as a product page can show without becoming a slideshow.
 *
 * Here rather than beside the action that enforces it: a `"use server"` module
 * may only export async functions, and the form has to stop offering "add
 * another" at the same number the server stops accepting them.
 */
export const MAX_GALLERY = 7;
