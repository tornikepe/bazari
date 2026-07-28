import type { PaymentProvider } from "@/generated/prisma/enums";

/**
 * Values written out rather than derived, so this can be imported without
 * pulling the generated client in. `satisfies` fails the build on drift.
 */
export const PAYMENT_PROVIDERS = ["manual"] as const satisfies readonly PaymentProvider[];

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return typeof value === "string" && (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}
