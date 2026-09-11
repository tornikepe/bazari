-- The wishlist, on the account.
--
-- It lived only in `localStorage`: one browser, until that browser was
-- cleared. This is the same list kept against the customer, merged with the
-- browser's on sign-in and written to on every heart pressed after that.
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","productId")
);

CREATE INDEX "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");

ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
