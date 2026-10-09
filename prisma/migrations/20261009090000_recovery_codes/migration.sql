-- A way back in that does not go through a mailbox, and a record of the way in.
--
-- The staff address on this shop is on a domain it does not receive mail at,
-- so "email me a link" recovers nothing. Eight one-time codes do instead:
-- made together, shown once, stored only as scrypt hashes, and spent on use.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastSignInAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "RecoveryCode" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "codeHash"  TEXT NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecoveryCode_userId_usedAt_idx" ON "RecoveryCode"("userId", "usedAt");

ALTER TABLE "RecoveryCode"
  ADD CONSTRAINT "RecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
