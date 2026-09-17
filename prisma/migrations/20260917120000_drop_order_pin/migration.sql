-- The pin on the map was taken out again the same day; the columns go
-- with it. Nothing was ever written to them.
ALTER TABLE "Order" DROP COLUMN "lat", DROP COLUMN "lng";
ALTER TABLE "Address" DROP COLUMN "lat", DROP COLUMN "lng";
