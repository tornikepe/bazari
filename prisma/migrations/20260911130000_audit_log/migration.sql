-- Who changed what in the dashboard, and when.
--
-- Append-only, like the stock ledger, and for the same reason: a price that
-- moved needs an answer with a name on it. `changes` holds only what moved,
-- as `{ field: [before, after] }`, and `label` is what the thing was called
-- at the time, so the row still reads after the thing is deleted.
CREATE TABLE "AuditEntry" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "changes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditEntry_createdAt_idx" ON "AuditEntry"("createdAt");
CREATE INDEX "AuditEntry_entity_entityId_idx" ON "AuditEntry"("entity", "entityId");
