-- The rest of the profile as the account page asks for it. Written by hand:
-- `migrate dev` also wanted to touch the generated search column, which is
-- not this migration's business.
ALTER TABLE "User"
  ADD COLUMN "birthDate" TIMESTAMP(3),
  ADD COLUMN "emailOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gender" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "personalId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "smsOptIn" BOOLEAN NOT NULL DEFAULT false;
