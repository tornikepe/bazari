import type { PaymentMethod, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Payment options offered at checkout, in display order.
 *
 * Same arrangement as `order-status.ts`: only the *type* comes from Prisma, so
 * Client Components can import this list without pulling the generated client
 * into the browser bundle. `satisfies` fails the build if it drifts from the
 * schema enum.
 */
export const PAYMENT_METHODS = [
  "cash_on_delivery",
  "card",
  "bank_transfer",
] as const satisfies readonly PaymentMethod[];

export const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "refunded",
] as const satisfies readonly PaymentStatus[];

export type { PaymentMethod, PaymentStatus };

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && (PAYMENT_STATUSES as readonly string[]).includes(value);
}
