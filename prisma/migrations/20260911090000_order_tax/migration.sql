-- VAT, recorded per order.
--
-- Georgian retail prices carry the tax inside them, so `tax` is the share of
-- `total` that is VAT, never an amount added on top. It is written at the
-- moment the order is placed, together with the rate it was worked out at,
-- because a rate change next year must not rewrite what this order paid.
ALTER TABLE "Order" ADD COLUMN "tax" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "taxRate" INTEGER NOT NULL DEFAULT 0;

-- Whole percent. 18 is Georgia's rate; zero means the shop is not registered
-- for VAT and no tax line is shown anywhere.
ALTER TABLE "ShopSettings" ADD COLUMN "vatRate" INTEGER NOT NULL DEFAULT 18;
