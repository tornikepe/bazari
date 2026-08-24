import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Finding products by text, and putting the best ones first.
 *
 * What this replaced was five `ILIKE '%…%'` scans OR-ed together. It worked,
 * in the sense that it returned rows — but no index could serve it, and
 * nothing was ranked: a product whose *name* was the query came back in the
 * same undifferentiated heap as one that happened to mention the word once in
 * a paragraph of description.
 *
 * ## Why two mechanisms
 *
 * **Full-text**, with the `simple` configuration, tokenises and lowercases and
 * — the part that matters — gives a rank, which is what turns a heap into an
 * order.
 *
 * It does not stem, and that is worth saying plainly rather than leaving as a
 * surprise: **Postgres ships no Georgian dictionary.** Not on Neon, not in the
 * `postgres:16` image CI runs. A stemmer for a language that inflects this
 * much is a real piece of linguistics rather than a configuration line, so
 * this does not pretend to have one.
 *
 * **Trigrams** are what stand in for it, and they do not care what language
 * anything is in. A Georgian word carrying a case ending shares nearly all of
 * its trigrams with the bare form, so `similarity()` finds it; the same
 * mechanism forgives a typo, which no stemmer would have. And the GIN trigram
 * index is what finally makes the substring behaviour this always had into
 * something the database can look up rather than scan.
 *
 * ## Why it returns ids
 *
 * The catalogue does far more than search: it facets by category, brand, price
 * and stock, and it pages. All of that is Prisma's, and rewriting it as raw SQL
 * to bolt on a ranking would trade a great deal of clarity for one feature. So
 * this answers only the question SQL is better at — *which products match, best
 * first* — and hands the ids back for the existing query to filter and page.
 */

/**
 * A ceiling on how many ids come back.
 *
 * They end up in an `IN (…)`, and a list of thousands is a query plan nobody
 * wants. Three hundred is more than any page of results can show and more than
 * a shopper will ever scroll; a query matching more than that is one that
 * needs narrowing rather than paginating.
 */
const MAX_MATCHES = 300;

/**
 * The ids of every active product matching `query`, best first.
 *
 * The order is the answer as much as the set is: the caller keeps it and uses
 * it as the relevance sort.
 */
export async function matchingProductIds(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "Product"
    WHERE "isActive"
      AND (
        to_tsvector('simple', "searchText") @@ plainto_tsquery('simple', ${trimmed})
        OR "searchText" ILIKE ${"%" + trimmed + "%"}
        /* strict_word_similarity, and neither of the other two.
           
           similarity() compares two whole strings, so against a paragraph of
           description any single word scores near nothing. word_similarity()
           fixes that but matches any continuous extent, so a five-letter query
           scores 0.5 against half the catalogue. The strict form aligns the
           extent to word boundaries, which is the question actually being
           asked: is there a *word* in here close to what was typed?
           
           Measured against this catalogue, not guessed: an exact hit scores
           1.0, a Georgian word carrying a case ending 0.56 to 0.75, and the
           noise floor sits at 0.29. Nothing here can rescue a mistyped short
           word — "ankre" for "anker" shares one trigram of three — and this
           does not pretend otherwise.
           
           (No backticks in this comment: it is inside a template literal.) */
        OR strict_word_similarity(${trimmed}, "searchText") > 0.4
      )
    ORDER BY
      /* A hit in the name beats a hit in a paragraph of description, and it is
         not close: somebody searching "anker" wants the Anker products, not
         the one whose description mentions an Anker cable in passing. */
      (CASE WHEN "nameKa" ILIKE ${"%" + trimmed + "%"} OR "nameEn" ILIKE ${"%" + trimmed + "%"} THEN 1 ELSE 0 END) DESC,
      ts_rank(to_tsvector('simple', "searchText"), plainto_tsquery('simple', ${trimmed})) DESC,
      strict_word_similarity(${trimmed}, "searchText") DESC,
      -- A stable tiebreaker, so two equally good matches do not swap places
      -- between one page of results and the next.
      "id" ASC
    LIMIT ${MAX_MATCHES}
  `;

  return rows.map((row) => row.id);
}
