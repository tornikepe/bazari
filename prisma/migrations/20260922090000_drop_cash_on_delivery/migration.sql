-- The shop is paid through the banks' gateways and by transfer; cash at the
-- door is gone from the checkout, so the value goes from the enum too.
--
-- The two orders that carried it were unpaid test orders from a throwaway
-- account; they become transfers so no row is left pointing at a value the
-- type no longer has. Nobody's money moved either way.
UPDATE "Order" SET "paymentMethod" = 'bank_transfer' WHERE "paymentMethod" = 'cash_on_delivery';
UPDATE "User" SET "preferredPayment" = NULL WHERE "preferredPayment" = 'cash_on_delivery';

ALTER TABLE "Order" ALTER COLUMN "paymentMethod" DROP DEFAULT;

ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'bank_transfer', 'tbc', 'bog', 'paypal', 'crypto');
ALTER TABLE "Order"
  ALTER COLUMN "paymentMethod" TYPE "PaymentMethod" USING ("paymentMethod"::text::"PaymentMethod");
ALTER TABLE "User"
  ALTER COLUMN "preferredPayment" TYPE "PaymentMethod" USING ("preferredPayment"::text::"PaymentMethod");
DROP TYPE "PaymentMethod_old";

ALTER TABLE "Order" ALTER COLUMN "paymentMethod" SET DEFAULT 'bank_transfer';

-- The switch that offered it has nothing left to switch.
ALTER TABLE "ShopSettings" DROP COLUMN "codEnabled";
