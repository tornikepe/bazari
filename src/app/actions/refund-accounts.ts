"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MAX_REFUND_ACCOUNTS } from "@/lib/refund-accounts";

export type RefundAccountResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "failed" | "signed-out" | "too-many" };

/** The shape the shop keeps: which bank, the number, the name on it. */
function read(formData: FormData) {
  const bank = String(formData.get("bank") ?? "");
  return {
    bank: bank === "tbc" || bank === "bog" ? bank : "",
    iban: String(formData.get("iban") ?? "")
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 34),
    holder: String(formData.get("holder") ?? "").trim().slice(0, 120),
  };
}

/** An IBAN as a bank writes it: two letters, two digits, then the rest. */
function looksLikeIban(value: string) {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(value);
}

/** Only one account is the default; setting one clears the others. */
async function setDefaultIn(
  tx: Pick<typeof prisma, "refundAccount">,
  userId: string,
  id: string,
) {
  await tx.refundAccount.updateMany({ where: { userId }, data: { isDefault: false } });
  await tx.refundAccount.updateMany({ where: { id, userId }, data: { isDefault: true } });
}

export async function saveRefundAccount(formData: FormData): Promise<RefundAccountResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signed-out" };

  const id = String(formData.get("id") ?? "").trim();
  const data = read(formData);
  /* All three, and the holder is not optional. A refund is a transfer to a
     named person: a bank matches the name against the account, and one sent
     to a number with nobody on it comes back days later with no explanation
     the shop can give. */
  if (!data.bank || !looksLikeIban(data.iban) || !data.holder) {
    return { ok: false, error: "invalid" };
  }

  const makeDefault = formData.get("isDefault") === "on";

  try {
    await prisma.$transaction(async (tx) => {
      if (id) {
        /* Scoped by user as well as id: the id came from a form, and a row
           that is not theirs must be a no-op rather than a thrown error
           that says one exists. */
        const { count } = await tx.refundAccount.updateMany({
          where: { id, userId: user.id },
          data,
        });
        if (count === 0) throw new Error("not yours");
        if (makeDefault) await setDefaultIn(tx, user.id, id);
        return;
      }

      const existing = await tx.refundAccount.count({ where: { userId: user.id } });
      if (existing >= MAX_REFUND_ACCOUNTS) throw new Error("too many");

      const created = await tx.refundAccount.create({
        data: { ...data, userId: user.id, isDefault: existing === 0 },
      });
      if (makeDefault) await setDefaultIn(tx, user.id, created.id);
    });
  } catch (error) {
    console.error("saveRefundAccount failed", error);
    return { ok: false, error: String(error).includes("too many") ? "too-many" : "failed" };
  }

  revalidatePath("/account/payments");
  return { ok: true };
}

export async function deleteRefundAccount(id: string): Promise<RefundAccountResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signed-out" };

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.refundAccount.deleteMany({ where: { id, userId: user.id } });
      if (count === 0) return;

      /* Deleting the default leaves a list with none; the older of what is
         left takes over, so a refund always has somewhere to go. */
      const stillDefault = await tx.refundAccount.count({
        where: { userId: user.id, isDefault: true },
      });
      if (stillDefault > 0) return;

      const next = await tx.refundAccount.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) await tx.refundAccount.update({ where: { id: next.id }, data: { isDefault: true } });
    });
  } catch (error) {
    console.error("deleteRefundAccount failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/account/payments");
  return { ok: true };
}

export async function makeDefaultRefundAccount(id: string): Promise<RefundAccountResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signed-out" };

  try {
    await prisma.$transaction((tx) => setDefaultIn(tx, user.id, id));
  } catch (error) {
    console.error("makeDefaultRefundAccount failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/account/payments");
  return { ok: true };
}
