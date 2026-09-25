-- The second step of a staff sign-in: the password was right, and a code
-- sent to the address on the account is the other half.
ALTER TYPE "TokenPurpose" ADD VALUE IF NOT EXISTS 'staff_login';

-- Foreign keys with nothing behind them. Postgres does not index a column
-- just because it references another table, so every one of these had to be
-- found by reading the whole table — on a delete, and on the questions the
-- dashboard asks about a product's sales and a coupon's orders.
CREATE INDEX IF NOT EXISTS "Order_couponId_idx" ON "Order" ("couponId");
CREATE INDEX IF NOT EXISTS "Order_deliveryZoneId_idx" ON "Order" ("deliveryZoneId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem" ("productId");
CREATE INDEX IF NOT EXISTS "OrderItem_variantId_idx" ON "OrderItem" ("variantId");
CREATE INDEX IF NOT EXISTS "Review_orderId_idx" ON "Review" ("orderId");
CREATE INDEX IF NOT EXISTS "Favorite_productId_idx" ON "Favorite" ("productId");
CREATE INDEX IF NOT EXISTS "ProductEvent_productId_idx" ON "ProductEvent" ("productId");
