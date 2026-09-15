"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkUpload, type UploadRefusal } from "@/lib/image-upload";
import { isPaymentMethod } from "@/lib/payment";

export type AvatarResult =
  | { ok: true }
  | { ok: false; error: UploadRefusal | "unauthorized" | "failed" };

/**
 * The customer's picture. Sniffed for what it is rather than trusted for
 * what the browser said, capped like a product photo, and stored on the
 * row; `getCurrentUser` versions the URL by `updatedAt`, which this bumps.
 */
export async function updateAvatar(formData: FormData): Promise<AvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const file = formData.get("avatar");
  if (!(file instanceof File)) return { ok: false, error: "empty" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkUpload(bytes);
  if (!checked.ok) return { ok: false, error: checked.reason };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar: Buffer.from(bytes), avatarType: checked.type },
    });
  } catch (error) {
    console.error("updateAvatar failed", error);
    return { ok: false, error: "failed" };
  }
  revalidatePath("/account", "layout");
  return { ok: true };
}

export async function removeAvatar(): Promise<AvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar: null, avatarType: "" },
    });
  } catch (error) {
    console.error("removeAvatar failed", error);
    return { ok: false, error: "failed" };
  }
  revalidatePath("/account", "layout");
  return { ok: true };
}

export type PaymentPrefsResult =
  { ok: true } | { ok: false; error: "unauthorized" | "invalid" | "failed" };

/**
 * What the customer chose on their payment page. An IBAN is kept as typed
 * minus its spaces and upper-cased — a person pastes it from a banking app
 * with spaces in it — and checked for shape, not for a bank: a refund is
 * made by a person who will see the number.
 */
export async function updatePaymentPrefs(
  formData: FormData,
): Promise<PaymentPrefsResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer")
    return { ok: false, error: "unauthorized" };

  const method = String(formData.get("preferredPayment") ?? "");
  const preferredPayment = isPaymentMethod(method) ? method : null;
  const refundIban = String(formData.get("refundIban") ?? "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 34);
  if (refundIban && !/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(refundIban)) {
    return { ok: false, error: "invalid" };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        preferredPayment,
        refundIban,
        refundName: String(formData.get("refundName") ?? "")
          .trim()
          .slice(0, 120),
        invoiceCompany: String(formData.get("invoiceCompany") ?? "")
          .trim()
          .slice(0, 160),
        invoiceTaxId: String(formData.get("invoiceTaxId") ?? "")
          .trim()
          .slice(0, 40),
      },
    });
  } catch (error) {
    console.error("updatePaymentPrefs failed", error);
    return { ok: false, error: "failed" };
  }
  revalidatePath("/account/payments");
  revalidatePath("/checkout");
  return { ok: true };
}
