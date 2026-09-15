"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type SpendResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "failed" };

/**
 * What the shop spent bringing people in, for one month.
 *
 * Typed in lari with decimals on the analytics page and stored as whole
 * tetri, like every other amount. The month is `YYYY-MM`; a figure for a
 * month with nothing yet is a row, a figure of zero on a month that had one
 * is that row set to zero — the row stays, so the audit trail can say what
 * it was before.
 */
export async function saveMarketingSpend(month: string, amountRaw: string): Promise<SpendResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, error: "invalid" };
  const parsed = Number(String(amountRaw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000_000) return { ok: false, error: "invalid" };
  const amount = Math.round(parsed * 100);

  try {
    const before = await prisma.marketingSpend.findUnique({ where: { month }, select: { amount: true } });
    await prisma.marketingSpend.upsert({
      where: { month },
      create: { month, amount },
      update: { amount },
    });
    await audit({
      actor: admin.email,
      action: "spend.update",
      entity: "spend",
      entityId: month,
      label: month,
      changes: { amount: [before?.amount ?? 0, amount] },
    });
  } catch (error) {
    console.error("saveMarketingSpend failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/dashboard/analytics");
  return { ok: true };
}
