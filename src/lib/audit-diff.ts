/**
 * The audit log's pure half: which writes exist, and what changed between two
 * shapes. Split from `audit.ts` for the same reason `auth-roles.ts` is split
 * from `auth.ts` — that module opens the database, and a unit test of `diff`
 * should not.
 */
/** Which write. The dashboard turns these into sentences. */
export const AUDIT_ACTIONS = [
  "product.create",
  "product.update",
  "product.delete",
  "product.stock",
  "product.active",
  "product.variants",
  "category.create",
  "category.update",
  "category.delete",
  "order.status",
  "payment.received",
  "payment.refund",
  "payment.gateway",
  "return.move",
  "coupon.create",
  "coupon.update",
  "coupon.active",
  "zone.create",
  "zone.update",
  "zone.delete",
  "settings.update",
  "page.update",
  "staff.invite",
  "staff.role",
  "staff.disable",
  /// A staff member rotating their own password. The password itself is
  /// never part of the entry — only that it changed, and when.
  "staff.password",
  "customer.disable",
  "review.publish",
  "spend.update",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** `{ field: [before, after] }` — only what moved. */
export type AuditChanges = Record<string, [unknown, unknown]>;

export type AuditInput = {
  actor: string;
  action: AuditAction;
  /** "product", "order", … — the first half of the action, unless said otherwise. */
  entity?: string;
  entityId?: string;
  /** What the thing was called at the time, so the row outlives a deletion. */
  label?: string;
  changes?: AuditChanges;
};

/**
 * What changed between two shapes, over the fields worth reporting.
 *
 * Compared as JSON so a `Date`, a `Json` column and a number all compare by
 * value; a field missing from `after` is treated as unchanged rather than as
 * cleared, which is what a partial update means.
 */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T & string)[],
): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of fields) {
    if (!(field in after)) continue;
    const from = before[field];
    const to = after[field];
    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) {
      changes[field] = [from ?? null, to ?? null];
    }
  }
  return changes;
}

