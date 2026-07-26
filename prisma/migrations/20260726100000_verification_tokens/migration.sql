-- Email verification and password-reset codes.

DO $$ BEGIN
  CREATE TYPE "TokenPurpose" AS ENUM ('email_verification', 'password_reset');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Accounts that predate verification are treated as already confirmed rather
-- than being locked out.
UPDATE "User" SET "emailVerified" = true;

CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "codeHash"  TEXT NOT NULL,
  "purpose"   "TokenPurpose" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VerificationToken_userId_purpose_idx" ON "VerificationToken"("userId", "purpose");
CREATE INDEX IF NOT EXISTS "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt");

DO $$ BEGIN
  ALTER TABLE "VerificationToken"
    ADD CONSTRAINT "VerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
