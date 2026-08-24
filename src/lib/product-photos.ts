/**
 * A product's photos: what they are, in what order, and what they show.
 *
 * The column is JSON, so nothing about its shape is guaranteed by the database
 * — the same bargain `product-specs.ts` makes, and the same answer: parse
 * defensively here, once, and let every reader have a typed list. A row
 * hand-edited into nonsense produces a product with no photos rather than a
 * page that throws.
 *
 * Nothing is imported into this file. The admin form needs it in the browser
 * to reorder a list, and the product page needs it on the server to draw one.
 */

export type Photo = {
  url: string;
  /** What the photo shows, per language. Empty when nobody has written one. */
  altKa: string;
  altEn: string;
};

/** The placeholder every product without a photo of its own shares. */
export const DEFAULT_PHOTO = "/products/placeholder.svg";

/** At most this many, which is what the upload control enforces. */
export const MAX_PHOTOS = 8;

export function parsePhotos(value: unknown): Photo[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const row = entry as Record<string, unknown>;
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!url) return [];

    return [
      {
        url,
        altKa: typeof row.altKa === "string" ? row.altKa.trim() : "",
        altEn: typeof row.altEn === "string" ? row.altEn.trim() : "",
      },
    ];
  });
}

/**
 * What to announce for a photo.
 *
 * The written description when there is one, and the product's name when there
 * is not. Never "photo 3 of 7": a position is not a description, and a screen
 * reader announcing it has told the listener nothing about the picture.
 *
 * The *decorative* case is deliberately not this function's business. A
 * thumbnail beside a name that is already read out should carry `alt=""`, and
 * that is a decision the markup makes, not this.
 */
export function altOf(photo: Photo | undefined, locale: "ka" | "en", productName: string): string {
  const written = locale === "ka" ? photo?.altKa : photo?.altEn;
  return written?.trim() || productName;
}

/** The main photo's URL, which is the first one. */
export function mainPhotoUrl(photos: Photo[]): string {
  return photos[0]?.url || DEFAULT_PHOTO;
}

/**
 * Moves one photo up or down the list.
 *
 * Returns a new list, and returns the same order rather than wrapping when the
 * move would fall off either end — a "move up" on the first photo that sent it
 * to the bottom would be a surprise, and the button is disabled there anyway.
 */
export function movePhoto(photos: Photo[], index: number, delta: -1 | 1): Photo[] {
  const target = index + delta;
  if (index < 0 || index >= photos.length || target < 0 || target >= photos.length) return photos;

  const next = [...photos];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/**
 * The list as the admin form posts it.
 *
 * Three parallel fields rather than one JSON blob in a hidden input, because a
 * form field is a thing a browser can post without JavaScript and a serialised
 * object is not. They are read positionally, so the three arrays must stay the
 * same length — which they do, because the form emits all three per photo.
 */
export function photosFromForm(form: {
  getAll: (name: string) => FormDataEntryValue[];
}): Photo[] {
  const urls = form.getAll("photoUrl").map((value) => String(value).trim());
  const ka = form.getAll("photoAltKa").map((value) => String(value).trim());
  const en = form.getAll("photoAltEn").map((value) => String(value).trim());

  const seen = new Set<string>();

  return urls
    .flatMap((url, index) => {
      if (!url || seen.has(url)) return [];
      seen.add(url);
      return [
        {
          url,
          altKa: (ka[index] ?? "").slice(0, 200),
          altEn: (en[index] ?? "").slice(0, 200),
        },
      ];
    })
    .slice(0, MAX_PHOTOS);
}
