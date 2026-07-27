-- Ledger rows that point at an order that no longer exists would break the
-- foreign key, so clear those first. In practice there are none: orders are
-- never hard-deleted.
UPDATE "StockMovement" sm
   SET "orderId" = NULL
 WHERE sm."orderId" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."id" = sm."orderId");

CREATE INDEX IF NOT EXISTS "StockMovement_orderId_idx" ON "StockMovement"("orderId");

DO $$
BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
