/**
 * The text format the information pages are written in.
 *
 * The pages render as a stack of headed sections, and the obvious way to store
 * that is JSON — which is also the wrong way, because the person editing these
 * is a shop owner, not a developer. A textarea they can type into beats a
 * structured editor nobody can use without being shown how.
 *
 * So the format is two rules, and that is the whole specification:
 *
 *     ## A heading            → starts a new section
 *     anything else           → a paragraph in the current section
 *     (blank lines separate paragraphs and are otherwise ignored)
 *
 * Text before the first `##` becomes a section with no heading, so a page can
 * be a few plain paragraphs without learning the syntax at all.
 */

export type InfoSection = { heading: string; body: string[] };

/** Placeholders the shop's real figures are substituted into. */
export type InfoValues = {
  freeShippingThreshold: string;
  shippingFee: string;
  shopName: string;
};

/**
 * Figures are written as `{freeShipping}`, not typed in as numbers.
 *
 * The shipping page once told customers delivery was free over ₾20,000 when
 * the rule said ₾200 — the sentence had the number written into it and nobody
 * updated it when the rule changed. A placeholder cannot drift: it is resolved
 * from the same settings the cart applies, every time the page renders.
 */
const PLACEHOLDERS: Record<string, keyof InfoValues> = {
  "{freeShipping}": "freeShippingThreshold",
  "{shippingFee}": "shippingFee",
  "{shopName}": "shopName",
};

export function substitute(text: string, values: InfoValues): string {
  let out = text;
  for (const [token, key] of Object.entries(PLACEHOLDERS)) {
    out = out.split(token).join(values[key]);
  }
  return out;
}

/** Parses the stored text into the sections the page renders. */
export function parseSections(raw: string, values: InfoValues): InfoSection[] {
  const sections: InfoSection[] = [];
  let current: InfoSection | null = null;

  for (const line of substitute(raw, values).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      current = { heading: trimmed.slice(3).trim(), body: [] };
      sections.push(current);
      continue;
    }

    // A paragraph before any heading still needs somewhere to live, or the
    // first thing an owner types vanishes.
    if (!current) {
      current = { heading: "", body: [] };
      sections.push(current);
    }
    current.body.push(trimmed);
  }

  return sections;
}

/** The inverse, for seeding the table from the text that ships in the repo. */
export function serialiseSections(sections: InfoSection[]): string {
  return sections
    .map((section) => {
      const heading = section.heading ? `## ${section.heading}\n` : "";
      return heading + section.body.join("\n\n");
    })
    .join("\n\n");
}
