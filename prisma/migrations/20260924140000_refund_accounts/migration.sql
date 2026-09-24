-- Where a refund goes, as a short list the customer keeps rather than one
-- account typed into the profile: the bank, the number, the name on it.
CREATE TABLE "RefundAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "iban" TEXT NOT NULL,
    "holder" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RefundAccount_userId_idx" ON "RefundAccount"("userId");

ALTER TABLE "RefundAccount" ADD CONSTRAINT "RefundAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The account already typed into the profile becomes the first row, so
-- nobody has to type it again.
INSERT INTO "RefundAccount" ("id", "userId", "bank", "iban", "holder", "isDefault", "createdAt", "updatedAt")
SELECT md5(random()::text || id), id, COALESCE(NULLIF("refundBank", ''), 'tbc'), "refundIban", "refundName", true, now(), now()
FROM "User"
WHERE "refundIban" <> '';
