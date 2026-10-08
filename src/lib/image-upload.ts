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

/* ------------------------------------------------------------------ */
/* Photographs people take, as opposed to pictures the shop publishes  */
/* ------------------------------------------------------------------ */

/**
 * One more format, for a picture nobody is going to publish.
 *
 * HEIC is what an iPhone hands over when the browser could not redraw the
 * photograph through a canvas first, and the one upload on this site where
 * that happens is the bank slip: it is looked at once, by the shop, and
 * never put on a page. It stays out of `ImageType` because everything that
 * *is* published has to render in a browser, and Chrome does not draw HEIC.
 */
export type PhotoType = ImageType | "image/heic";

/** The HEIF brands an iPhone writes. `avif` is handled above, as an image. */
const HEIF_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]);

/** As `sniffImageType`, plus HEIC. Null is still a refusal. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  const published = sniffImageType(bytes);
  if (published) return published;

  if (!matches(bytes, 4, [0x66, 0x74, 0x79, 0x70])) return null;
  const brand = String.fromCharCode(...bytes.slice(8, 12));
  return HEIF_BRANDS.has(brand) ? "image/heic" : null;
}

/** As `checkUpload`, for the one upload that may also be a HEIC. */
export function checkPhotoUpload(
  bytes: Uint8Array,
): { ok: true; type: PhotoType } | { ok: false; reason: UploadRefusal } {
  if (bytes.byteLength === 0) return { ok: false, reason: "empty" };
  if (bytes.byteLength > MAX_BYTES) return { ok: false, reason: "too-large" };

  const type = sniffPhotoType(bytes);
  if (!type) return { ok: false, reason: "not-an-image" };

  return { ok: true, type };
}
