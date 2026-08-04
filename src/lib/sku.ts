/**
 * Stock-keeping unit generation.
 *
 * An SKU is a warehouse's internal handle for one sellable thing. It exists so
 * a person holding a box can say which product it is without reading a
 * Georgian product name off a label, and so two shelves of the same phone in
 * different colours are two different codes. Nothing on the storefront shows
 * it; it is for the people packing the orders.
 *
 * Which means it has exactly two requirements — unique, and short enough to
 * write on a box by hand — and no requirement at all to be meaningful. So the
 * shop owner is never asked to invent one.
 *
 * The shape is `CAT-XXXXX`: three letters from the category, then five
 * characters of randomness. The prefix is there only so a human sorting a
 * pallet can group by department at a glance; the code carries no other
 * information, deliberately. SKUs that encode price or supplier go stale the
 * moment either changes, and then quietly lie.
 */

/**
 * No I, O, 0 or 1. These are read aloud in a warehouse and copied off labels
 * by hand, and those four are the pairs people get wrong. Dropping them costs
 * four of thirty-six symbols and removes the whole class of mistake.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RANDOM_LENGTH = 5;

/** Latin letters only — a Georgian category name gives no usable prefix. */
function prefixFrom(source: string) {
  const letters = source.toUpperCase().replace(/[^A-Z]/g, "");
  return letters.slice(0, 3).padEnd(3, "X");
}

function randomPart(random: () => number) {
  let out = "";
  for (let i = 0; i < RANDOM_LENGTH; i++) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return out;
}

/**
 * One candidate code. Uniqueness is the caller's problem, because only the
 * caller can ask the database — see `generateSku` for the retrying version.
 */
export function skuCandidate(categorySlug: string, random: () => number = Math.random) {
  return `${prefixFrom(categorySlug)}-${randomPart(random)}`;
}

/**
 * A code that is free, or `null` after enough tries.
 *
 * 32^5 is 33.5 million combinations per prefix, so a collision in a catalogue
 * of this size is remote — but "remote" is not "impossible", and an SKU
 * collision surfaces as a unique-constraint violation at save time, i.e. as a
 * lost form. Six attempts costs nothing and removes the failure mode; the
 * `null` is still handled rather than assumed away.
 */
export async function generateSku(
  categorySlug: string,
  isTaken: (sku: string) => Promise<boolean>,
  attempts = 6,
): Promise<string | null> {
  for (let i = 0; i < attempts; i++) {
    const candidate = skuCandidate(categorySlug);
    if (!(await isTaken(candidate))) return candidate;
  }
  return null;
}
