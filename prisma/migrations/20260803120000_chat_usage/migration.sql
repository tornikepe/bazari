-- Monthly token spend for the contact assistant.
--
-- One row per calendar month, keyed by "YYYY-MM" in UTC, so the budget resets
-- on the 1st without a scheduled job to clear it.
CREATE TABLE IF NOT EXISTS "ChatUsage" (
    "month" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatUsage_pkey" PRIMARY KEY ("month")
);

-- Token counts come from the API and are never negative. A negative figure
-- would mean an accounting bug, and it would understate the bill — which is
-- the one direction a spend cap must not be wrong in.
DO $$ BEGIN
  ALTER TABLE "ChatUsage"
    ADD CONSTRAINT "ChatUsage_counts_non_negative"
    CHECK (
      "requests" >= 0
      AND "inputTokens" >= 0
      AND "outputTokens" >= 0
      AND "cacheWriteTokens" >= 0
      AND "cacheReadTokens" >= 0
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
