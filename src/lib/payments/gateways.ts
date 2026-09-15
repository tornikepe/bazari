import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { open, seal } from "@/lib/secret-box";
import { getAdapter } from "@/lib/payments";
import type { GatewayConfig, PaymentProvider } from "@/lib/payments/types";

/**
 * The online gateways as the dashboard configured them.
 *
 * Four of them, one row each in `PaymentGateway`: on or off, test or live,
 * and the fields their adapter asked for. Secrets are sealed on the way in
 * and opened on the way out, and only here — an adapter sees plain text and
 * never the sealed form. `manual` and `sandbox` are not rows: the first has
 * nothing to configure and the second is switched by the environment.
 */

export const GATEWAY_IDS = ["tbc", "bog", "paypal", "crypto"] as const;
export type GatewayId = (typeof GATEWAY_IDS)[number];

export function isGatewayId(value: unknown): value is GatewayId {
  return (
    typeof value === "string" &&
    (GATEWAY_IDS as readonly string[]).includes(value)
  );
}

export type Gateway = {
  provider: GatewayId;
  enabled: boolean;
  testMode: boolean;
  /** Opened, and carrying the mode as `__testMode` for the calls that get no input. */
  config: GatewayConfig;
  /** True when every required field is filled — the checkout's condition. */
  configured: boolean;
};

function openConfig(raw: unknown, testMode: boolean): GatewayConfig {
  const config: GatewayConfig = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string") config[key] = open(value);
    }
  }
  config.__testMode = testMode ? "1" : "0";
  return config;
}

/** Every gateway, configured or not — the dashboard's list. Once per request. */
export const getGateways = cache(async (): Promise<Gateway[]> => {
  const rows = await prisma.paymentGateway.findMany();
  return GATEWAY_IDS.map((provider) => {
    const row = rows.find((entry) => entry.provider === provider);
    const testMode = row?.testMode ?? true;
    const config = openConfig(row?.config, testMode);
    return {
      provider,
      enabled: row?.enabled ?? false,
      testMode,
      config,
      configured: getAdapter(provider).isConfigured(config),
    };
  });
});

/** One gateway, or `null` for a provider that is not one of the four. */
export async function getGateway(
  provider: PaymentProvider,
): Promise<Gateway | null> {
  if (!isGatewayId(provider)) return null;
  return (
    (await getGateways()).find((gateway) => gateway.provider === provider) ??
    null
  );
}

/** The ones the checkout may offer: switched on and fully configured. */
export async function enabledGateways(): Promise<Gateway[]> {
  return (await getGateways()).filter(
    (gateway) => gateway.enabled && gateway.configured,
  );
}

/**
 * Writes a gateway's row. A blank secret keeps the one already stored —
 * the form never shows a secret back, so blank is what "unchanged" looks
 * like from there — and a filled one is sealed before it is written.
 */
export async function writeGateway(
  provider: GatewayId,
  input: {
    enabled: boolean;
    testMode: boolean;
    fields: Record<string, string>;
  },
): Promise<{ configured: boolean }> {
  const adapter = getAdapter(provider);
  const existing = await prisma.paymentGateway.findUnique({
    where: { provider },
  });
  const stored = (existing?.config ?? {}) as Record<string, string>;

  const config: Record<string, string> = {};
  for (const field of adapter.fields) {
    const given = (input.fields[field.key] ?? "").trim();
    if (field.secret) {
      if (given) config[field.key] = seal(given);
      else if (stored[field.key]) config[field.key] = stored[field.key];
    } else {
      config[field.key] = given;
    }
  }

  await prisma.paymentGateway.upsert({
    where: { provider },
    create: {
      provider,
      enabled: input.enabled,
      testMode: input.testMode,
      config,
    },
    update: { enabled: input.enabled, testMode: input.testMode, config },
  });

  // Read back through the same opening the checkout uses, not through the
  // per-request cache, which still holds the row as it was.
  return {
    configured: adapter.isConfigured(openConfig(config, input.testMode)),
  };
}
