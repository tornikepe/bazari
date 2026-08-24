-- Somebody waiting for a product to come back.
--
-- A shop that is out of something loses the sale twice: once now, and again
-- when the box arrives and nobody knows. This is the shopper leaving an
-- address rather than being asked to come back and check.
--
-- The row is deleted the moment the message is sent. It is somebody's email
-- address attached to a thing they want, held only for as long as it takes to
-- tell them — keeping it afterwards would be keeping a list nobody asked to be
-- on.
CREATE TABLE "StockAlert" (
  "id"        TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  -- The language they asked in, so the message arrives in it.
  "locale"    TEXT NOT NULL DEFAULT 'ka',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- One request per address per product. Asking twice is the same as asking
-- once, and without this a script could queue a million rows against one item.
CREATE UNIQUE INDEX "StockAlert_productId_email_key" ON "StockAlert"("productId", "email");

CREATE INDEX "StockAlert_productId_idx" ON "StockAlert"("productId");

-- Deleting a product takes its waiting list with it: there is nothing left to
-- tell anybody about.
ALTER TABLE "StockAlert"
  ADD CONSTRAINT "StockAlert_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
