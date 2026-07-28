-- Backstop for the conditional decrement in `placeOrder`: even a future code
-- path that forgets the guard cannot drive stock below zero.
UPDATE "Product" SET "stock" = 0 WHERE "stock" < 0;

DO $$
BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_non_negative" CHECK ("stock" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
