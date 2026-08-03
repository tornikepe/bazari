-- Money moves from Float (lari) to Int (tetri).
--
-- ROUND before casting: the stored doubles are already approximations, so
-- 149.99 may sit at 149.98999999999998 and a plain cast would truncate to
-- 14998. ROUND(x * 100) recovers the intended figure.
--
-- The CHECK constraints are new: a negative price or total was never valid,
-- and an integer column is the natural place to say so.

ALTER TABLE "Product"
  ALTER COLUMN "price"     TYPE INTEGER USING ROUND("price" * 100),
  ALTER COLUMN "oldPrice"  TYPE INTEGER USING ROUND("oldPrice" * 100),
  ALTER COLUMN "costPrice" TYPE INTEGER USING ROUND("costPrice" * 100),
  ALTER COLUMN "costPrice" SET DEFAULT 0;

ALTER TABLE "Coupon"
  ALTER COLUMN "amountOff"     TYPE INTEGER USING ROUND("amountOff" * 100),
  ALTER COLUMN "minOrderTotal" TYPE INTEGER USING ROUND("minOrderTotal" * 100),
  ALTER COLUMN "minOrderTotal" SET DEFAULT 0;

ALTER TABLE "Order"
  ALTER COLUMN "subtotal" TYPE INTEGER USING ROUND("subtotal" * 100),
  ALTER COLUMN "shipping" TYPE INTEGER USING ROUND("shipping" * 100),
  ALTER COLUMN "discount" TYPE INTEGER USING ROUND("discount" * 100),
  ALTER COLUMN "total"    TYPE INTEGER USING ROUND("total" * 100),
  ALTER COLUMN "subtotal" SET DEFAULT 0,
  ALTER COLUMN "shipping" SET DEFAULT 0,
  ALTER COLUMN "discount" SET DEFAULT 0;

ALTER TABLE "OrderItem"
  ALTER COLUMN "price"     TYPE INTEGER USING ROUND("price" * 100),
  ALTER COLUMN "costPrice" TYPE INTEGER USING ROUND("costPrice" * 100),
  ALTER COLUMN "costPrice" SET DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_price_non_negative" CHECK ("price" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_total_non_negative" CHECK ("total" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
