"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MAX_ADDRESSES } from "@/lib/addresses";

/**
 * A customer's address book.
 *
 * Every action here re-reads the session and scopes its query by `userId`.
 * The id in the form is a customer's own claim about which row they mean, and
 * a `where: { id }` alone would let anyone with an id edit somebody else's
 * home address — `where: { id, userId }` is the whole defence, and it is
 * repeated on purpose rather than factored into a helper that could one day
 * be called without it.
 */
export type AddressResult = { ok: true } | { ok: false; error: "invalid" | "failed" | "signed-out" };

function read(formData: FormData) {
  const value = (key: string) => String(formData.get(key) ?? "").trim().slice(0, 120);

  return {
    label: value("label"),
    fullName: value("fullName"),
    phone: value("phone"),
    city: value("city"),
    street: value("street"),
    note: value("note"),
  };
}

/**
 * Says why, in the server log, whenever this refuses.
 *
 * An action that answers "no" and writes nothing is impossible to support:
 * the browser shows one generic note and the reason never leaves the process.
 * The reason only — never the address, which is somebody's home.
 */
function refuse(where: string, error: "invalid" | "failed" | "signed-out"): AddressResult {
  console.error(`[addresses] ${where} refused: ${error}`);
  return { ok: false, error };
}

export async function saveAddress(formData: FormData): Promise<AddressResult> {
  const user = await getCurrentUser();
  if (!user) return refuse("saveAddress", "signed-out");

  const id = String(formData.get("id") ?? "").trim();
  const data = read(formData);

  // A courier needs all four. A label is the customer's own note to self.
  if (!data.fullName || !data.phone || !data.city || !data.street) {
    return refuse("saveAddress", "invalid");
  }

  const makeDefault = formData.get("isDefault") === "on";

  try {
    await prisma.$transaction(async (tx) => {
      if (id) {
        /* Scoped by user as well as id: the id came from a form. `updateMany`
           rather than `update` because a row that is not theirs must be a
           no-op, not a thrown "record not found" that says one exists. */
        const { count } = await tx.address.updateMany({
          where: { id, userId: user.id },
          data,
        });
        if (count === 0) throw new Error("not yours");
      } else {
        const existing = await tx.address.count({ where: { userId: user.id } });
        if (existing >= MAX_ADDRESSES) throw new Error("too many");

        const created = await tx.address.create({
          data: {
            ...data,
            userId: user.id,
            // The first one saved is the default, because a book of one has
            // an obvious answer and asking would be a question for its own sake.
            isDefault: existing === 0,
          },
        });

        if (makeDefault) await setDefaultIn(tx, user.id, created.id);
        return;
      }

      if (makeDefault) await setDefaultIn(tx, user.id, id);
    });
  } catch (error) {
    console.error("saveAddress failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function deleteAddress(id: string): Promise<AddressResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signed-out" };

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.address.deleteMany({ where: { id, userId: user.id } });
      if (count === 0) return;

      /* Deleting the default leaves a book with no default, and checkout
         would then prefill nothing for someone who still has two addresses.
         The oldest remaining one takes over — an arbitrary rule, but a stated
         one, and better than none. */
      const stillDefault = await tx.address.count({ where: { userId: user.id, isDefault: true } });
      if (stillDefault > 0) return;

      const next = await tx.address.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    });
  } catch (error) {
    console.error("deleteAddress failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true };
}

export async function makeDefaultAddress(id: string): Promise<AddressResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signed-out" };

  try {
    await prisma.$transaction((tx) => setDefaultIn(tx, user.id, id));
  } catch (error) {
    console.error("makeDefaultAddress failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/account");
  revalidatePath("/checkout");
  return { ok: true };
}

/**
 * Moves the flag, in one transaction.
 *
 * Clearing every row and then setting one is two writes that must not be seen
 * apart: between them the customer has no default at all, and a checkout
 * rendering in that window prefills nothing.
 */
async function setDefaultIn(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  id: string,
) {
  const { count } = await tx.address.updateMany({
    where: { id, userId },
    data: { isDefault: true },
  });
  if (count === 0) throw new Error("not yours");

  await tx.address.updateMany({
    where: { userId, isDefault: true, NOT: { id } },
    data: { isDefault: false },
  });
}
