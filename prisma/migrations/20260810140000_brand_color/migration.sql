-- The shop's brand colour: one hex, from which the whole brand ramp is derived
-- for both themes at render time.
--
-- Defaulting to the stylesheet's own red means every existing row keeps exactly
-- the palette it already had, and the derivation short-circuits on that value
-- to the hand-tuned tokens rather than recomputing an approximation of them.
ALTER TABLE "ShopSettings" ADD COLUMN "brandColor" TEXT NOT NULL DEFAULT '#dc1f24';

-- Stored lowercase and hashed, so the equality check against the default is a
-- plain comparison and two spellings of the same colour cannot disagree.
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_brandColor_format"
  CHECK ("brandColor" ~ '^#[0-9a-f]{6}$');
