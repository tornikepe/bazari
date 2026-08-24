-- Size and colour.
--
-- Three tables rather than one, because the two questions a shopper is asked
-- ("which size?", "which colour?") and the thing they end up buying (one
-- combination, with its own barcode and its own pile in the stockroom) are
-- different objects. Folding them into a single "variant" row with a text
-- label would make "show me every red one" a string search.
--
-- The combinations are generated from the options rather than typed in one by
-- one: three sizes and two colours is six rows, and nobody should have to
-- enter six rows to say "six".
CREATE TABLE "ProductOption" (
  "id"        TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "nameKa"    TEXT NOT NULL,
  "nameEn"    TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductOption_productId_idx" ON "ProductOption"("productId");

CREATE TABLE "ProductOptionValue" (
  "id"        TEXT NOT NULL,
  "optionId"  TEXT NOT NULL,
  "valueKa"   TEXT NOT NULL,
  "valueEn"   TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ProductOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductOptionValue_optionId_idx" ON "ProductOptionValue"("optionId");

-- One buyable combination: its own SKU, its own stock, and a price only when
-- it differs from the product's.
CREATE TABLE "ProductVariant" (
  "id"        TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "sku"       TEXT NOT NULL,
  -- Tetri, like every other amount here. NULL means "the product's price",
  -- which is not the same as zero and is why the column is nullable.
  "price"     INTEGER,
  "stock"     INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- Which values make up which combination.
CREATE TABLE "VariantValue" (
  "variantId" TEXT NOT NULL,
  "valueId"   TEXT NOT NULL,

  CONSTRAINT "VariantValue_pkey" PRIMARY KEY ("variantId", "valueId")
);

CREATE INDEX "VariantValue_valueId_idx" ON "VariantValue"("valueId");

-- What was bought, snapshotted like the name and the price beside it: a
-- variant renamed or deleted next year must not rewrite what an order says.
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "variantLabel" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ProductOption"
  ADD CONSTRAINT "ProductOption_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductOptionValue"
  ADD CONSTRAINT "ProductOptionValue_optionId_fkey"
  FOREIGN KEY ("optionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantValue"
  ADD CONSTRAINT "VariantValue_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VariantValue"
  ADD CONSTRAINT "VariantValue_valueId_fkey"
  FOREIGN KEY ("valueId") REFERENCES "ProductOptionValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The order keeps pointing at the variant while it exists, and keeps its own
-- copy of the label when it does not — the same bargain `productId` already
-- has with `product`.
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
