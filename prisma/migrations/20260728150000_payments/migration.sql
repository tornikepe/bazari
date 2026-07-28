DO $$ BEGIN
  CREATE TYPE "PaymentProvider" AS ENUM ('manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentState" AS ENUM
    ('pending', 'authorized', 'captured', 'failed', 'cancelled', 'expired', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Payment" (
    "id"          TEXT NOT NULL,
    "orderId"     TEXT NOT NULL,
    "provider"    "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "state"       "PaymentState" NOT NULL DEFAULT 'pending',
    "amount"      INTEGER NOT NULL,
    "currency"    TEXT NOT NULL DEFAULT 'GEL',
    "refunded"    INTEGER NOT NULL DEFAULT 0,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "capturedAt"  TIMESTAMP(3),
    "failReason"  TEXT NOT NULL DEFAULT '',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentEvent" (
    "id"         TEXT NOT NULL,
    "paymentId"  TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "state"      "PaymentState" NOT NULL,
    "payload"    TEXT NOT NULL DEFAULT '',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX IF NOT EXISTS "Payment_state_idx" ON "Payment"("state");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_providerRef_key"
    ON "Payment"("provider", "providerRef");

CREATE INDEX IF NOT EXISTS "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");
-- The idempotency guarantee: a replayed webhook cannot insert twice.
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentEvent_paymentId_externalId_key"
    ON "PaymentEvent"("paymentId", "externalId");

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_non_negative" CHECK ("amount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Cannot refund more than was charged.
DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refund_within_amount"
    CHECK ("refunded" >= 0 AND "refunded" <= "amount");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
