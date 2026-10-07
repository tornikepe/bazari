-- A shelf the shop would rather not show yet.
--
-- Visibility only: hiding a category takes it out of the bar, the home page,
-- the catalogue's filters, the sitemap and the assistant's answers, and
-- leaves its products on sale. Everything that exists today was visible, so
-- the default is true and no row needs touching.

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Category_isVisible_sortOrder_idx" ON "Category"("isVisible", "sortOrder");
