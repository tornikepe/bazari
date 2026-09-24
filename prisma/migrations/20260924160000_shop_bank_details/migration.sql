-- Where a transfer should be sent. Shown at the checkout as soon as the
-- shopper chooses to pay that way, and typed in on the dashboard.
ALTER TABLE "ShopSettings"
  ADD COLUMN "bankIban" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "bankHolder" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "bankName" TEXT NOT NULL DEFAULT '';
