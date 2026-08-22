-- Specifications for the product page.
--
-- JSON rather than a table for the same reason `images` is an array: a
-- specification belongs to exactly one product, is never queried on its own and
-- is never joined to. What it needs is an *order*, which a list has and a set of
-- rows does not without a column to carry it.
--
-- NOT NULL with a default, so every existing row reads as "no specifications"
-- rather than as a null every caller has to remember to handle.
ALTER TABLE "Product"
  ADD COLUMN "specs" JSONB NOT NULL DEFAULT '[]'::jsonb;
