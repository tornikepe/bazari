-- Where the shop is on social media. Four optional addresses; the footer
-- draws a mark only for the ones that are filled in.
ALTER TABLE "ShopSettings"
  ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "tiktokUrl"    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "facebookUrl"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "youtubeUrl"   TEXT NOT NULL DEFAULT '';
