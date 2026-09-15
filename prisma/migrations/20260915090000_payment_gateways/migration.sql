-- Online gateways configured from the dashboard rather than the environment.
-- Each is both a way an order can be paid (PaymentMethod) and a gateway that
-- handled it (PaymentProvider); the two enums share the ids.
ALTER TYPE "PaymentMethod" ADD VALUE 'tbc';
ALTER TYPE "PaymentMethod" ADD VALUE 'bog';
ALTER TYPE "PaymentMethod" ADD VALUE 'paypal';
ALTER TYPE "PaymentMethod" ADD VALUE 'crypto';

ALTER TYPE "PaymentProvider" ADD VALUE 'tbc';
ALTER TYPE "PaymentProvider" ADD VALUE 'bog';
ALTER TYPE "PaymentProvider" ADD VALUE 'paypal';
ALTER TYPE "PaymentProvider" ADD VALUE 'crypto';

-- What a gateway was asked for when that is not lari (PayPal and the crypto
-- processor take no GEL): the figure, in that currency's minor unit, that a
-- callback has to match.
ALTER TABLE "Payment" ADD COLUMN "chargedAmount" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "chargedCurrency" TEXT;

-- One row per gateway: on or off, live or test, and its credentials, with
-- the secret ones sealed before they are written.
CREATE TABLE "PaymentGateway" (
    "provider" "PaymentProvider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentGateway_pkey" PRIMARY KEY ("provider")
);
