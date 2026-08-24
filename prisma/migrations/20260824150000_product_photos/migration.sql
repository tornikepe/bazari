-- Photos that have an order and can be described.
--
-- There were two columns and no way to say anything about either: `image` held
-- the main photo, `images` a bare list of URLs beside it. Nothing carried alt
-- text, so every product photo on the site was announced as "photo 2 of 7" —
-- a position, not a description — and nothing carried an order that could be
-- changed, so re-photographing a product meant deleting the list and adding it
-- back in the right sequence.
--
-- One ordered list replaces both. Index 0 is the main photo: the card, the
-- search result, the order line and the Open Graph tag all want exactly one,
-- and this is the one they get. `image` stays beside it as a mirror of that
-- first URL — the catalogue's list queries select it for every card, and a
-- JSON lookup per row to draw twelve thumbnails is a cost paid on the busiest
-- page of the shop for a value that changes once a season.
--
-- A column rather than a table, for the same reason `specs` is one: photos
-- belong to exactly one product, are never queried on their own, are never
-- joined to, and the order is the array's.
ALTER TABLE "Product" ADD COLUMN "photos" JSONB NOT NULL DEFAULT '[]';

-- Everything that exists now, main photo first, described by nobody yet.
UPDATE "Product" SET "photos" = COALESCE(
  (
    SELECT jsonb_agg(jsonb_build_object('url', url, 'altKa', '', 'altEn', '') ORDER BY position)
    FROM unnest(ARRAY["image"] || "images") WITH ORDINALITY AS t(url, position)
    WHERE url IS NOT NULL AND url <> ''
  ),
  '[]'::jsonb
);

ALTER TABLE "Product" DROP COLUMN "images";
