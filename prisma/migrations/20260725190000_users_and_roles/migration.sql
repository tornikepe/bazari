-- AdminUser becomes User with a role, so customers and staff share one table
-- and one session mechanism. Renaming (rather than dropping and recreating)
-- keeps the existing admin account and its password hash intact.
CREATE TYPE "Role" AS ENUM ('customer', 'admin');

ALTER TABLE "AdminUser" RENAME TO "User";
ALTER TABLE "User" RENAME CONSTRAINT "AdminUser_pkey" TO "User_pkey";
ALTER INDEX "AdminUser_email_key" RENAME TO "User_email_key";

ALTER TABLE "User"
  ADD COLUMN "phone"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN "city"      TEXT NOT NULL DEFAULT '',
  ADD COLUMN "address"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN "role"      "Role" NOT NULL DEFAULT 'customer',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User" ALTER COLUMN "name" SET DEFAULT '';

-- Everyone already in this table was an admin.
UPDATE "User" SET "role" = 'admin';

CREATE INDEX "User_role_idx" ON "User"("role");

-- Orders may belong to a signed-in customer; guest checkout leaves it null.
ALTER TABLE "Order" ADD COLUMN "userId" TEXT;
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
