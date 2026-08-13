-- Extra photos for the product page.
--
-- A list column rather than a table: these are URLs in a fixed order belonging
-- to exactly one product, never queried on their own and never joined to. The
-- uploaded bytes already live in "ProductImage"; this is only the order they
-- are shown in.
--
-- NOT NULL with a default, so every existing row gets an empty list rather
-- than a null that every reader would have to remember to handle.
ALTER TABLE "Product"
  ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
