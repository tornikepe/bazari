/**
 * Facts about staff accounts that both the actions and the page need.
 *
 * Here rather than in the `"use server"` module, which may only export async
 * functions.
 */
import type { Role } from "@/generated/prisma/enums";

export const STAFF_ROLES = ["admin", "viewer"] as const satisfies readonly Role[];

/** How long an invitation is good for. */
export const INVITE_HOURS = 48;

export function isStaffRole(value: unknown): value is (typeof STAFF_ROLES)[number] {
  return value === "admin" || value === "viewer";
}
