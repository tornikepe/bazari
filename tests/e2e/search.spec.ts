import { expect, test, type Page } from "@playwright/test";
import { useEnglish } from "./helpers";

/**
 * Searching the catalogue.
 *
 * What this is really testing is the two things the old `ILIKE '%…%'` could
 * not do. It could find a product; it could not say which of the matches was
 * the best one, and it could not find anything at all unless the query was a
 * literal substring — which in Georgian means a word carrying a case ending
 * finds nothing.
 *
 * Postgres ships no Georgian stemmer, so neither does this. Trigrams stand in
 * for one: a suffixed form shares almost all of its trigrams with the bare
 * word, which is also why a typo still finds what was meant.
 */

const cards = (page: Page) => page.locator("main article");

async function search(page: Page, query: string) {
  await page.goto(`/catalog?q=${encodeURIComponent(query)}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test("a match in the name beats a match in the description @engine", async ({ page }) => {
  await useEnglish(page);
  await search(page, "anker");

  await expect(cards(page).first()).toBeVisible();

  /* The first card is an Anker product, not merely one whose description
     mentions the word. Ranking is the whole point: the old search returned an
     undifferentiated heap, and the first result was whichever happened to be
     newest. */
  await expect(
    cards(page).first(),
    "the best match is not first",
  ).toContainText(/anker/i);
});

test("a Georgian word carrying a case ending still finds it @engine", async ({ page }) => {
  await useEnglish(page);

  /* This is the case the old search could not do at all, and the reason there
     are trigrams here rather than only full-text. The catalogue calls these
     ყურსასმენი; a shopper asking for ყურსასმენებით is asking for the same
     thing, and neither a substring match nor an unstemmed tsvector finds it.
     
     Postgres has no Georgian stemmer to do this properly. A suffixed form
     shares most of its trigrams with the bare one, which is what stands in. */
  await search(page, "ყურსასმენებით");

  await expect(
    cards(page).first(),
    "a suffixed Georgian query found nothing",
  ).toBeVisible();
});

test("relevance is the default while searching, and not offered otherwise @engine", async ({
  page,
}) => {
  await useEnglish(page);

  await search(page, "anker");
  /* The desktop control is a `select`, so the offer is an option rather than a
     button — and it is the one selected, because relevance is the default
     while there is something to be relevant to. */
  const sort = page.locator("main select").first();
  await expect(sort.getByRole("option", { name: /best match/i })).toHaveCount(1);
  await expect(sort).toHaveValue("relevance");

  await page.goto("/catalog");
  /* And it is not offered at all on an unsearched catalogue — "sorted by how
     well it matches nothing" is a heading with nothing behind it. */
  await expect(page.locator("main select").first().getByRole("option", { name: /best match/i }))
    .toHaveCount(0);
});

test("a query that matches nothing says so rather than showing everything @engine", async ({
  page,
}) => {
  await useEnglish(page);
  await search(page, "zzzzqqqqxxxx");

  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText(/nothing|no products|no results/i).first()).toBeVisible();
});
