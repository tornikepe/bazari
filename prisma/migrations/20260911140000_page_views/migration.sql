-- Page views without cookies.
--
-- One row per shop day and path with a count in it, and one row per visitor
-- per day whose `hash` is keyed on a secret that changes daily — so the
-- figure "how many people came" exists and the question "who" cannot be
-- asked of it.
CREATE TABLE "PageView" (
    "day" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("day","path")
);

CREATE INDEX "PageView_day_idx" ON "PageView"("day");

CREATE TABLE "DailyVisitor" (
    "day" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "DailyVisitor_pkey" PRIMARY KEY ("day","hash")
);
