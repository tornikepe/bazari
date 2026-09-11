import "server-only";

import { prisma } from "@/lib/prisma";
import type { AuditInput } from "@/lib/audit-diff";

export { AUDIT_ACTIONS, diff } from "@/lib/audit-diff";
export type { AuditAction, AuditChanges, AuditInput } from "@/lib/audit-diff";

/**
 * The dashboard's audit log: who changed what, and when.
 *
 * Every write a staff member can make goes through `audit()` after it has
 * committed. After, not inside: a log that could fail a save is a log that
 * gets removed the first time it does, and a save that happened must be
 * reported as one whatever became of the note about it. So this never throws
 * — a failure to record is written to the server log and the action returns
 * its own result.
 */

export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEntry.create({
      data: {
        actor: input.actor,
        action: input.action,
        entity: input.entity ?? input.action.split(".")[0]!,
        entityId: input.entityId ?? "",
        label: (input.label ?? "").slice(0, 200),
        changes: JSON.parse(JSON.stringify(input.changes ?? {})),
      },
    });
  } catch (error) {
    console.error("[audit] could not record", input.action, error);
  }
}
