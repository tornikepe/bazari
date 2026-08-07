-- Everything about the shop that is not a product.
--
-- One row, pinned to a fixed id. A settings *table* with many rows would be a
-- key/value store, and a key/value store gives up the one thing worth having
-- here: the schema. `freeShippingThreshold` is an integer of tetri and the
-- database says so, rather than it being a string somebody has to remember to
-- parse the same way in four places.
--
-- Every default below is the constant the code used before this table existed,
-- so applying this migration changes nothing on screen. The values move from
-- source files into a row; the row starts out saying exactly what the source
-- files said.
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL DEFAULT 'shop',

    -- Identity
    "name" TEXT NOT NULL DEFAULT 'Bazari',
    "titleSuffixKa" TEXT NOT NULL DEFAULT 'ონლაინ მაღაზია',
    "titleSuffixEn" TEXT NOT NULL DEFAULT 'online store',
    "taglineKa" TEXT NOT NULL DEFAULT '',
    "taglineEn" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT NOT NULL DEFAULT '',

    -- Contact. All optional: the contact page renders only what is filled in
    -- rather than showing a row with a dash in it, and an empty string here is
    -- the honest state for a shop that has not got a phone number yet.
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "contactAddress" TEXT NOT NULL DEFAULT '',
    "contactHoursKa" TEXT NOT NULL DEFAULT '',
    "contactHoursEn" TEXT NOT NULL DEFAULT '',

    -- Commerce. Tetri, like every other amount in this schema.
    "currencySymbol" TEXT NOT NULL DEFAULT '₾',
    "freeShippingThreshold" INTEGER NOT NULL DEFAULT 20000,
    "shippingFee" INTEGER NOT NULL DEFAULT 1500,
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,

    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- A negative shipping fee or threshold is not a configuration, it is a bug
-- that would hand money back at checkout.
ALTER TABLE "ShopSettings"
  ADD CONSTRAINT "ShopSettings_shippingFee_check" CHECK ("shippingFee" >= 0),
  ADD CONSTRAINT "ShopSettings_freeShippingThreshold_check" CHECK ("freeShippingThreshold" >= 0);

-- The one row. `id` defaults to 'shop' and is the primary key, so a second row
-- can only be created by naming a different id deliberately.
INSERT INTO "ShopSettings" ("id", "updatedAt") VALUES ('shop', NOW());
