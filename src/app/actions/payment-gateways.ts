"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getAdapter } from "@/lib/payments";
import { getGateway, isGatewayId, writeGateway } from "@/lib/payments/gateways";

export type SaveGatewayResult =
  | { ok: true; configured: boolean }
  | { ok: false; error: "unauthorized" | "invalid" | "failed" };

/**
 * Saves one gateway's row from the dashboard's form.
 *
 * `getCurrentAdmin`, not staff: a viewer reads which gateways are on and
 * changes none of them, and this action takes a POST from anywhere. What is
 * logged is which switches moved and which fields were filled — never a
 * value, since the values are the keys to the shop's money.
 */
export async function savePaymentGateway(
  formData: FormData,
): Promise<SaveGatewayResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const provider = String(formData.get("provider") ?? "");
  if (!isGatewayId(provider)) return { ok: false, error: "invalid" };

  const adapter = getAdapter(provider);
  const fields: Record<string, string> = {};
  for (const field of adapter.fields) {
    fields[field.key] = String(formData.get(field.key) ?? "")
      .trim()
      .slice(0, 500);
  }

  const before = await getGateway(provider);
  const input = {
    enabled: formData.get("enabled") === "on",
    testMode: formData.get("testMode") === "on",
    fields,
  };

  let configured = false;
  try {
    ({ configured } = await writeGateway(provider, input));
  } catch (error) {
    console.error("savePaymentGateway failed", error);
    return { ok: false, error: "failed" };
  }
  await audit({
    actor: admin.email,
    action: "payment.gateway",
    entityId: provider,
    label: adapter.name,
    changes: {
      ...(before?.enabled !== input.enabled
        ? { enabled: [before?.enabled ?? false, input.enabled] }
        : {}),
      ...(before?.testMode !== input.testMode
        ? { testMode: [before?.testMode ?? true, input.testMode] }
        : {}),
      ...Object.fromEntries(
        adapter.fields
          .filter((field) => fields[field.key] !== "")
          .map((field) => [
            field.key,
            ["…", field.secret ? "(set)" : fields[field.key]],
          ]),
      ),
    },
  });

  revalidatePath("/dashboard/payments");
  revalidatePath("/checkout");
  return { ok: true, configured };
}
