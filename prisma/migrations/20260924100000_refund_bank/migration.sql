-- A refund goes back to an account at a bank, and the shop asks which one
-- rather than reading it out of the IBAN.
ALTER TABLE "User" ADD COLUMN "refundBank" TEXT NOT NULL DEFAULT '';
