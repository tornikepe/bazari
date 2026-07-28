CREATE TABLE IF NOT EXISTS "RateLimit" (
    "key"      TEXT NOT NULL,
    "count"    INTEGER NOT NULL DEFAULT 0,
    "windowAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- Lets a periodic cleanup drop expired windows without a full scan.
CREATE INDEX IF NOT EXISTS "RateLimit_windowAt_idx" ON "RateLimit"("windowAt");
