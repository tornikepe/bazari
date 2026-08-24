-- Searching the catalogue properly.
--
-- Until now every query was five `ILIKE '%…%'` scans OR-ed together: no index
-- could help, nothing was ranked, and a product whose name matched came back
-- in the same undifferentiated heap as one that mentioned the word once in its
-- description.
--
-- Two mechanisms, because one is not enough for this language.
--
--   * Full-text, with the `simple` configuration. It tokenises and lowercases
--     and gives a rank, which is what turns a heap into an order. It does not
--     stem: **Postgres ships no Georgian dictionary**, and neither Neon nor the
--     `postgres:16` image CI runs has one to install. A stemmer for a language
--     with this much suffixing is a real piece of linguistics, not a config
--     line, so it is not pretended at here.
--
--   * Trigrams, which do not care what language anything is in. This is what
--     covers what the stemmer would have: a Georgian word carrying a case
--     ending still shares almost all of its trigrams with the bare form, and
--     the same mechanism forgives a typo. It is also what makes the old
--     substring behaviour indexable rather than a sequential scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Everything worth matching against, in one column, maintained by the database.
-- A trigger would be a second place for this to be wrong; a generated column
-- cannot drift from the row it is generated from.
ALTER TABLE "Product" ADD COLUMN "searchText" TEXT
  GENERATED ALWAYS AS (
    coalesce("nameKa", '') || ' ' ||
    coalesce("nameEn", '') || ' ' ||
    coalesce("brand", '') || ' ' ||
    coalesce("sku", '') || ' ' ||
    coalesce("descriptionKa", '') || ' ' ||
    coalesce("descriptionEn", '')
  ) STORED;

-- For `ILIKE '%…%'` and for `similarity()`, both of which this index serves.
CREATE INDEX "Product_searchText_trgm_idx"
  ON "Product" USING GIN ("searchText" gin_trgm_ops);

-- And for whole-token matching, which is what ranks a two-word query.
CREATE INDEX "Product_searchText_fts_idx"
  ON "Product" USING GIN (to_tsvector('simple', "searchText"));
