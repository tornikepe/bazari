-- Courier or pickup, and what a courier costs where.
--
-- One fee for the whole country was the rule while the shop was a demo; a
-- real courier charges Tbilisi and Svaneti differently. A zone is that
-- difference given a name and a price. No zones at all means the shop-wide
-- fee applies everywhere, exactly as before this migration.
CREATE TYPE "DeliveryMethod" AS ENUM ('courier', 'pickup');

CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "nameKa" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "fee" INTEGER NOT NULL,
    "freeAbove" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryZone_isActive_sortOrder_idx" ON "DeliveryZone"("isActive", "sortOrder");

-- Every existing order went by courier: that was the only way anything left.
ALTER TABLE "Order" ADD COLUMN "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'courier';
ALTER TABLE "Order" ADD COLUMN "deliveryZoneId" TEXT;
-- The zone's name at the time, so a zone renamed or removed later does not
-- blank out where an old order went.
ALTER TABLE "Order" ADD COLUMN "deliveryZoneKa" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN "deliveryZoneEn" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryZoneId_fkey"
  FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Off until the shop says where to collect from.
ALTER TABLE "ShopSettings" ADD COLUMN "pickupEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN "pickupAddress" TEXT NOT NULL DEFAULT '';
