-- A customer's saved delivery addresses.
--
-- The three fields already on "User" are left alone: they are what checkout
-- prefills for someone who has saved nothing, and rewriting every account to
-- move them would be a migration with no benefit. This table is the book —
-- the second address, the office, somewhere a present is being sent.
CREATE TABLE "Address" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "label"     TEXT NOT NULL DEFAULT '',
  "fullName"  TEXT NOT NULL,
  "phone"     TEXT NOT NULL,
  "city"      TEXT NOT NULL,
  "street"    TEXT NOT NULL,
  "note"      TEXT NOT NULL DEFAULT '',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- Deleting an account takes its addresses with it. They are of no use to
-- anybody once the account is gone, and keeping them would be keeping
-- someone's home address after they asked to be forgotten.
ALTER TABLE "Address"
  ADD CONSTRAINT "Address_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
