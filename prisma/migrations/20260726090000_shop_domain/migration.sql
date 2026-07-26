-- Fuller shop domain: cost tracking, a stock ledger, coupons, payment state
-- and an order timeline.
--
-- Written defensively (IF NOT EXISTS / DO blocks) because an earlier attempt
-- failed partway through on a duplicate SKU and left some columns behind.

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('cash_on_delivery', 'card', 'bank_transfer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "StockReason" AS ENUM ('restock', 'sale', 'correction', 'return_to_stock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Product ------------------------------------------------------------------
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku"        TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "costPrice"  DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lowStockAt" INTEGER NOT NULL DEFAULT 10;

-- Backfill with a row number rather than an id prefix: cuids generated in the
-- same batch share their leading characters, which collided on the first run.
WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "Product"
)
UPDATE "Product" p
SET "sku" = 'BZ-' || LPAD(numbered.n::text, 4, '0')
FROM numbered
-- Unconditional: the column is introduced by this migration, and a failed
-- earlier attempt may have left colliding values behind.
WHERE p."id" = numbered."id";

ALTER TABLE "Product" ALTER COLUMN "sku" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku");
CREATE INDEX IF NOT EXISTS "Product_createdAt_idx" ON "Product"("createdAt");

UPDATE "Product" SET "costPrice" = ROUND(("price" * 0.62)::numeric, 2) WHERE "costPrice" = 0;

-- Coupon -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Coupon" (
  "id"            TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "percentOff"    INTEGER,
  "amountOff"     DOUBLE PRECISION,
  "minOrderTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxUses"       INTEGER,
  "usedCount"     INTEGER NOT NULL DEFAULT 0,
  "expiresAt"     TIMESTAMP(3),
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX IF NOT EXISTS "Coupon_isActive_idx" ON "Coupon"("isActive");

-- StockMovement ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id"        TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "delta"     INTEGER NOT NULL,
  "reason"    "StockReason" NOT NULL,
  "balance"   INTEGER NOT NULL,
  "note"      TEXT NOT NULL DEFAULT '',
  "orderId"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StockMovement_productId_idx" ON "StockMovement"("productId");
CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

DO $$ BEGIN
  ALTER TABLE "StockMovement"
    ADD CONSTRAINT "StockMovement_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Order --------------------------------------------------------------------
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subtotal"    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipping"    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discount"    DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "couponId"    TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'cash_on_delivery';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippedAt"   TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

-- Existing orders only stored a total; reconstruct the breakdown from items.
UPDATE "Order" o
SET "subtotal" = COALESCE(
  (SELECT SUM(i."price" * i."quantity") FROM "OrderItem" i WHERE i."orderId" = o."id"), 0)
WHERE o."subtotal" = 0;
UPDATE "Order" SET "shipping" = GREATEST("total" - "subtotal", 0) WHERE "shipping" = 0;
UPDATE "Order" SET "paymentStatus" = 'paid' WHERE "status" = 'delivered';
UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE "status" = 'delivered' AND "deliveredAt" IS NULL;
UPDATE "Order" SET "shippedAt"   = "updatedAt" WHERE "status" IN ('shipped', 'delivered') AND "shippedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON "Order"("paymentStatus");

DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OrderEvent ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrderEvent" (
  "id"        TEXT NOT NULL,
  "orderId"   TEXT NOT NULL,
  "status"    "OrderStatus" NOT NULL,
  "note"      TEXT NOT NULL DEFAULT '',
  "actor"     TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

DO $$ BEGIN
  ALTER TABLE "OrderEvent"
    ADD CONSTRAINT "OrderEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- OrderItem ----------------------------------------------------------------
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "sku"       TEXT NOT NULL DEFAULT '';
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "OrderItem" i
SET "sku"       = COALESCE(p."sku", ''),
    "costPrice" = COALESCE(p."costPrice", 0)
FROM "Product" p
WHERE i."productId" = p."id" AND i."sku" = '';
