-- CreateTable
CREATE TABLE "ProductEvent" (
    "day" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("day","productId","kind")
);

-- CreateTable
CREATE TABLE "MarketingSpend" (
    "month" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSpend_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE INDEX "ProductEvent_day_idx" ON "ProductEvent"("day");

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
