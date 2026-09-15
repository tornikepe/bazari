-- The customer's own settings: a picture, and what they chose on their
-- payment page — the method the checkout preselects, an account to refund
-- cash and transfer orders to, and the company line an invoice carries.
ALTER TABLE "User" ADD COLUMN "avatar" BYTEA;
ALTER TABLE "User" ADD COLUMN "avatarType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "preferredPayment" "PaymentMethod";
ALTER TABLE "User" ADD COLUMN "refundIban" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "refundName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "invoiceCompany" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "invoiceTaxId" TEXT NOT NULL DEFAULT '';
