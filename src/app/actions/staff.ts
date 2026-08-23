"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth-hash";
import { isStaffRole } from "@/lib/staff";
import { issueInvite } from "@/lib/verification";

/**
 * Who works here, and what they may do.
 *
 * Two rules run through every action below, and both exist because the
 * dashboard can be locked from the inside:
 *
 *   1. An admin cannot change or disable their own account here. Demoting
 *      yourself to viewer is one click away from being unable to undo it.
 *   2. The last admin cannot be demoted or disabled at all. A shop with no
 *      administrator has no way back in except the database.
 */
export type StaffResult =
  | { ok: true }
  | { ok: true; inviteUrl: string }
  | {
      ok: false;
      error: "unauthorized" | "invalid" | "self" | "last-admin" | "taken" | "failed";
    };

async function countOtherAdmins(exceptId: string) {
  return prisma.user.count({
    where: { role: "admin", disabledAt: null, NOT: { id: exceptId } },
  });
}

export async function setStaffRole(userId: string, role: string): Promise<StaffResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };
  if (!isStaffRole(role) && role !== "customer") return { ok: false, error: "invalid" };
  if (userId === admin.id) return { ok: false, error: "self" };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target) return { ok: false, error: "invalid" };

  if (target.role === "admin" && role !== "admin" && (await countOtherAdmins(userId)) === 0) {
    return { ok: false, error: "last-admin" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role,
        /* A change of role changes what every open session may do, and a
           cookie already in a browser carries the old one. Bumping the
           version makes them sign in again with the rights they now have. */
        sessionVersion: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("setStaffRole failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

export async function setStaffDisabled(userId: string, disabled: boolean): Promise<StaffResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };
  if (userId === admin.id) return { ok: false, error: "self" };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!target) return { ok: false, error: "invalid" };

  if (disabled && target.role === "admin" && (await countOtherAdmins(userId)) === 0) {
    return { ok: false, error: "last-admin" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        disabledAt: disabled ? new Date() : null,
        // Ends whatever is already open, rather than waiting for it to expire.
        sessionVersion: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("setStaffDisabled failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/dashboard/staff");
  return { ok: true };
}

/**
 * Invites someone, and hands back a link rather than sending one.
 *
 * No mail provider is configured, so an invitation that could only arrive by
 * email would not arrive at all. The link is shown to the admin to pass on
 * however they like; when a provider is set up, the same token is what gets
 * emailed.
 *
 * The account is created with a password nobody knows — 32 random bytes,
 * hashed and thrown away. It cannot be signed into until the invitee sets
 * their own at the link, which means no password is ever chosen for somebody
 * else or sent anywhere.
 */
export async function inviteStaff(formData: FormData): Promise<StaffResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, error: "unauthorized" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const role = String(formData.get("role") ?? "viewer");

  if (!email.includes("@") || email.length < 5) return { ok: false, error: "invalid" };
  if (!isStaffRole(role)) return { ok: false, error: "invalid" };

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    /* An address that already has an account is promoted rather than
       refused: "that email is taken" is a dead end for an admin who is trying
       to give an existing customer access. */
    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { role, disabledAt: null, sessionVersion: { increment: 1 } },
          select: { id: true },
        })
      : await prisma.user.create({
          data: {
            email,
            name,
            role,
            password: hashPassword(randomBytes(32).toString("hex")),
            emailVerified: false,
          },
          select: { id: true },
        });

    const token = await issueInvite(user.id);

    revalidatePath("/dashboard/staff");
    return { ok: true, inviteUrl: `/invite?token=${token}` };
  } catch (error) {
    console.error("inviteStaff failed", error);
    return { ok: false, error: "failed" };
  }
}

