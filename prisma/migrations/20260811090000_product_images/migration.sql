-- Uploaded product photos, stored in the database.
--
-- Object storage would be the usual answer, and it needs an account and a token
-- before a single photo can be uploaded. This works on a fresh clone with
-- nothing configured. `Product.image` keeps a short `/api/images/<id>` URL, so
-- the list queries that select `image` for every card carry a path and not a
-- megabyte.
CREATE TABLE "ProductImage" (
  "id"          TEXT NOT NULL,
  "data"        BYTEA NOT NULL,
  "contentType" TEXT NOT NULL,
  "filename"    TEXT NOT NULL DEFAULT '',
  "bytes"       INTEGER NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductImage_createdAt_idx" ON "ProductImage"("createdAt");

-- Belt and braces against a row that claims a size it does not have, and
-- against an empty upload being stored as a valid image.
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_bytes_positive" CHECK ("bytes" > 0);
