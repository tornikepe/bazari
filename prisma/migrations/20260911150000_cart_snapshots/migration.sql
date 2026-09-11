-- A copy of a signed-in shopper's cart, so a cart left behind can be written
-- about the next day. Replaced on every change, deleted when the cart
-- empties; `remindedAt` stops anybody being written to twice about it.
CREATE TABLE "CartSnapshot" (
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "remindedAt" TIMESTAMP(3),

    CONSTRAINT "CartSnapshot_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "CartSnapshot_updatedAt_idx" ON "CartSnapshot"("updatedAt");

ALTER TABLE "CartSnapshot" ADD CONSTRAINT "CartSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
