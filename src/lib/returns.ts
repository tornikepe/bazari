import type { ReturnReason, ReturnStatus } from "@/generated/prisma/enums";

/**
 * The rules of a return, with no database in them.
 *
 * Only the *types* come from Prisma, the same arrangement as `order-status.ts`,
 * so the form on the order page can import the list of reasons without
 * pulling the generated client into the browser bundle.
 */

export const RETURN_REASONS = [
  "damaged",
  "wrong_item",
  "not_as_described",
  "changed_mind",
  "other",
] as const satisfies readonly ReturnReason[];

export const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "received",
  "refunded",
] as const satisfies readonly ReturnStatus[];

export type { ReturnReason, ReturnStatus };

export function isReturnReason(value: unknown): value is ReturnReason {
  return typeof value === "string" && (RETURN_REASONS as readonly string[]).includes(value);
}

export function isReturnStatus(value: unknown): value is ReturnStatus {
  return typeof value === "string" && (RETURN_STATUSES as readonly string[]).includes(value);
}

/**
 * Where a request may go from where it is.
 *
 * A line, not a graph: the shop answers yes or no, then the goods arrive, then
 * the money goes back. `rejected` is final, and so is `refunded`. Nothing
 * moves backwards — a shop that approved by mistake rejects the next request
 * rather than un-approving this one, because the shopper may already have
 * posted the parcel.
 */
export const RETURN_TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = {
  requested: ["approved", "rejected"],
  approved: ["received", "rejected"],
  received: ["refunded"],
  rejected: [],
  refunded: [],
};

export function canMoveReturn(from: ReturnStatus, to: ReturnStatus): boolean {
  return RETURN_TRANSITIONS[from].includes(to);
}

/** A request the shop has not finished with. */
export function isOpenReturn(status: ReturnStatus): boolean {
  return status === "requested" || status === "approved" || status === "received";
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a shopper may ask, right now, about this order.
 *
 * Three things must be true: the order was delivered, the window has not
 * closed, and nothing is already in flight. A rejected request does not
 * block a second one — the shop may have said no to the reason and yes to a
 * better-explained one — but an open request does, because two parcels for
 * one order is a mess nobody can reconcile.
 *
 * `windowDays` of zero means the shop does not take returns at all.
 */
export function mayRequestReturn(
  order: { status: string; deliveredAt: Date | null },
  existing: readonly { status: ReturnStatus }[],
  windowDays: number,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: "not-delivered" | "window-closed" | "already-open" | "off" } {
  if (windowDays <= 0) return { ok: false, reason: "off" };
  if (order.status !== "delivered" || !order.deliveredAt) {
    return { ok: false, reason: "not-delivered" };
  }
  if (now.getTime() - order.deliveredAt.getTime() > windowDays * DAY_MS) {
    return { ok: false, reason: "window-closed" };
  }
  if (existing.some((request) => isOpenReturn(request.status) || request.status === "refunded")) {
    return { ok: false, reason: "already-open" };
  }
  return { ok: true };
}
