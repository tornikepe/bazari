"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

/**
 * Switching a customer's account off, and back on.
 *
 * The column and the sign-in refusal already existed for staff. What was
 * missing was any way to reach them for the people the shop actually has most
 * of: a customer who charges back every order, or an account somebody signed
 * up with by mistake, could only be dealt with in Prisma Studio.
 *
 * The row stays. An order points at the customer who placed it, and deleting
 * the account takes the answer to "who bought this" with it — which is why
 * `User.disabledAt` is a timestamp rather than the row being removed.
 *
 * Staff are deliberately out of reach here. A staff account is managed on the
 * staff page, which knows about the last-admin rule and about not letting
 * somebody lock themselves out; letting the customers table reach the same
 * column would be a second way to do the same job with none of the guards.
 */

export type CustomerResult =
  | { ok: true; count?: number }
  | { ok: false; error: "unauthorized" | "invalid" | "staff" | "failed" };

async function apply(ids: string[], disabled: boolean): Promise<number> {
  const { count } = await prisma.user.updateMany({
    // `role: "customer"` in the filter, not checked beforehand: a crafted post
    // carrying a staff id updates nothing rather than being told it was
    // refused, and the count says how many rows the shop was allowed to move.
    where: { id: { in: ids }, role: "customer" },
    data: {
      disabledAt: disabled ? new Date() : null,
      // Ends whatever is already open rather than waiting for it to expire.
      sessionVersion: { increment: 1 },
    },
  });
  return count;
}

export async function setCustomerDisabled(
  userId: string,
  disabled: boolean,
): Promise<CustomerResult> {
  if (!(await getCurrentAdmin())) return { ok: false, error: "unauthorized" };
  if (typeof userId !== "string" || userId.length === 0) return { ok: false, error: "invalid" };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target) return { ok: false, error: "invalid" };
  if (target.role !== "customer") return { ok: false, error: "staff" };

  try {
    await apply([userId], disabled);
  } catch (error) {
    console.error("setCustomerDisabled failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${userId}`);
  return { ok: true, count: 1 };
}

/** The same switch, thrown for a selection. */
export async function bulkCustomers(
  disabled: boolean,
  ids: string[],
): Promise<CustomerResult> {
  if (!(await getCurrentAdmin())) return { ok: false, error: "unauthorized" };

  /* Deduplicated and capped, like the product and order paths: the ids arrive
     from a form, so a crafted post can carry any number of them. */
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))].slice(
    0,
    100,
  );
  if (unique.length === 0) return { ok: false, error: "invalid" };

  let count: number;
  try {
    count = await apply(unique, disabled);
  } catch (error) {
    console.error("bulkCustomers failed", error);
    return { ok: false, error: "failed" };
  }

  for (const id of unique) revalidatePath(`/dashboard/customers/${id}`);
  revalidatePath("/dashboard/customers");
  return { ok: true, count };
}
