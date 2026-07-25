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
