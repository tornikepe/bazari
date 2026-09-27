-- The photograph of a bank transfer, attached to the order it pays for.
-- The shop has no gateway telling it the money arrived, so the slip is the
-- evidence; it is required before an order paid this way can be placed.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "receipt" BYTEA,
  ADD COLUMN IF NOT EXISTS "receiptType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "receiptAt" TIMESTAMP(3);
