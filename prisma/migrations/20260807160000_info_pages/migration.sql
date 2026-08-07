-- The footer's information pages, out of source and into rows.
--
-- Bilingual columns rather than a row per language, matching how Category and
-- Product already do it: one page is one row, and the two languages of a page
-- are edited side by side because they are the same page.
--
-- Body text is stored in the small format described in `info-content.ts` —
-- `## ` starts a section, everything else is a paragraph. Not JSON: the person
-- editing these is a shop owner, and a textarea they can type into beats a
-- structured editor nobody can use without being shown how.
CREATE TABLE "InfoPage" (
    "slug"        TEXT NOT NULL,
    "titleKa"     TEXT NOT NULL DEFAULT '',
    "titleEn"     TEXT NOT NULL DEFAULT '',
    "introKa"     TEXT NOT NULL DEFAULT '',
    "introEn"     TEXT NOT NULL DEFAULT '',
    "bodyKa"      TEXT NOT NULL DEFAULT '',
    "bodyEn"      TEXT NOT NULL DEFAULT '',
    -- An unpublished page is hidden from the footer rather than rendering an
    -- empty shell. A shop with no returns policy should not link to a blank
    -- returns page.
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoPage_pkey" PRIMARY KEY ("slug")
);
