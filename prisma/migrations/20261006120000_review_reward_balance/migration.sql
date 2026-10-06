-- What a shopper earns for reviewing something they bought, and the ledger
-- that explains the figure on their account.

CREATE TYPE "BalanceReason" AS ENUM ('review_reward', 'adjustment');

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "balance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ShopSettings"
  ADD COLUMN IF NOT EXISTS "reviewRewardTetri" INTEGER NOT NULL DEFAULT 500;

CREATE TABLE "BalanceEntry" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "amount"    INTEGER NOT NULL,
  "reason"    "BalanceReason" NOT NULL,
  "reviewId"  TEXT,
  "note"      TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BalanceEntry_pkey" PRIMARY KEY ("id")
);

-- One payment per review, however many times it is rewritten.
CREATE UNIQUE INDEX "BalanceEntry_reviewId_key" ON "BalanceEntry"("reviewId");
CREATE INDEX "BalanceEntry_userId_createdAt_idx" ON "BalanceEntry"("userId", "createdAt");

ALTER TABLE "BalanceEntry"
  ADD CONSTRAINT "BalanceEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
