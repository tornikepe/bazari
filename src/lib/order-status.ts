import type { OrderStatus } from "@/generated/prisma/enums";

/**
 * The order lifecycle, in the order it's displayed.
 *
 * Only the *type* comes from Prisma — the values are written out here so
 * Client Components (the status dropdown, the badge) can import this without
 * pulling the generated client into the browser bundle. `satisfies` makes
 * TypeScript fail the build if this list ever drifts from the schema enum.
 */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export type { OrderStatus };

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** One reached status and when — what the timeline is drawn from. */
export type ReachedStep = { status: OrderStatus; at: string };

/**
 * An order's history, reconstructed rather than trusted.
 *
 * `OrderEvent` is the record, but an order placed before that table existed
 * — or one whose events were pruned — would show an empty timeline while
 * plainly being delivered. The columns on the order itself are the other
 * witness, so both are merged and the earliest time for each status wins.
 * The current status is always shown as reached, even if nothing recorded
 * when — a "shipped" order with no timestamp still shipped.
 */
export function orderHistory(order: {
  status: OrderStatus;
  createdAt: Date;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  events: { status: OrderStatus; createdAt: Date }[];
}): ReachedStep[] {
  const reached = new Map<OrderStatus, Date>();
  const note = (status: OrderStatus, at: Date | null) => {
    if (!at) return;
    const existing = reached.get(status);
    if (!existing || at < existing) reached.set(status, at);
  };

  note("pending", order.createdAt);
  for (const event of order.events) note(event.status, event.createdAt);
  note("shipped", order.shippedAt);
  note("delivered", order.deliveredAt);
  if (!reached.has(order.status)) reached.set(order.status, order.createdAt);

  return [...reached.entries()]
    .map(([status, at]) => ({ status, at: at.toISOString() }))
    .sort((a, b) => a.at.localeCompare(b.at));
}
