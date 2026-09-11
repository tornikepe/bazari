-- A returns process, not only a page about one.
--
-- The shopper asks; the shop answers in the same row, so the order page can
-- show where things stand without a phone call. `received` is the one status
-- that touches stock, and it does so through the same ledger every other
-- movement uses.
CREATE TYPE "ReturnStatus" AS ENUM ('requested', 'approved', 'rejected', 'received', 'refunded');
CREATE TYPE "ReturnReason" AS ENUM ('damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'other');

CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "ReturnStatus" NOT NULL DEFAULT 'requested',
    "staffNote" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");
CREATE INDEX "ReturnRequest_status_createdAt_idx" ON "ReturnRequest"("status", "createdAt");

ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Which lines, and how many of each: one of two shirts back is one shirt
-- back on the shelf, not two.
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReturnItem_requestId_orderItemId_key" ON "ReturnItem"("requestId", "orderItemId");
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");

ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Days after delivery in which a return may be asked for. Zero switches the
-- form off without touching the policy page.
ALTER TABLE "ShopSettings" ADD COLUMN "returnWindowDays" INTEGER NOT NULL DEFAULT 14;
