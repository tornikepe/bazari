-- A dashboard listing somebody wants to come back to.
--
-- The orders page already answers "unpaid, this month, biggest first" — it is
-- four controls and a URL. What it could not do is remember the answer, so the
-- same four controls were set again every morning. A saved view is that URL's
-- query string with a name on it.
--
-- Per user rather than per shop: two people running the same dashboard watch
-- different things, and a shared list of views is a list that grows until
-- nobody can find their own.
CREATE TABLE "SavedView" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  -- Which listing it belongs to: "orders", "products", "customers".
  "page"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  -- The query string without its leading "?", e.g. "status=pending&sort=total".
  "query"     TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- One name per listing per person. Saving over a name replaces what it points
-- at, which is what "save" means when the name is already on screen.
CREATE UNIQUE INDEX "SavedView_userId_page_name_key" ON "SavedView"("userId", "page", "name");

CREATE INDEX "SavedView_userId_page_idx" ON "SavedView"("userId", "page");

-- Deleting an account takes its views with it: they are one person's shortcuts
-- and mean nothing to anybody else.
ALTER TABLE "SavedView"
  ADD CONSTRAINT "SavedView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
