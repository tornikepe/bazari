-- Switching an account off, and inviting one.
--
-- `disabledAt` rather than a delete: an order points at the customer who
-- placed it, and a removed staff account takes its own audit trail with it.
-- Sign-in is refused while the column is set, and bumping `sessionVersion`
-- alongside it ends every session that is already open.
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);

-- A staff member setting their password for the first time. The same token
-- table as verification and password reset, so there is one place that knows
-- how a one-time code is stored, expires and is spent.
ALTER TYPE "TokenPurpose" ADD VALUE 'staff_invite';
