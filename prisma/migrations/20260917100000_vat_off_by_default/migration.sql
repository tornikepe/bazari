-- The tax line is off until the shop says it is registered: the default
-- becomes zero, and the one settings row that still carries the old default
-- goes with it.
ALTER TABLE "ShopSettings" ALTER COLUMN "vatRate" SET DEFAULT 0;
UPDATE "ShopSettings" SET "vatRate" = 0 WHERE "vatRate" = 18;
