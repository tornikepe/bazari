"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/auth";

const StaffRoleContext = createContext<Role>("admin");

/**
 * Carries the signed-in staff member's role down to the client components that
 * draw the dashboard's controls.
 *
 * This is for presentation only. A `viewer` is stopped from writing by
 * `getCurrentAdmin` inside each Server Action; what this decides is whether
 * they are shown a button that would fail. Showing a control that always
 * errors is its own kind of lie, but hiding one is not a security boundary and
 * must never be treated as one.
 */
export function StaffRoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <StaffRoleContext.Provider value={role}>{children}</StaffRoleContext.Provider>;
}

export function useStaffRole() {
  return useContext(StaffRoleContext);
}

/** True when this staff member may change what they are looking at. */
export function useCanWrite() {
  return useContext(StaffRoleContext) === "admin";
}

/**
 * Renders its children only for staff who can actually use them.
 *
 * For write controls that live on a server component and would otherwise need
 * the whole page turned into a client component to ask about the role.
 */
export function WriteOnly({ children }: { children: React.ReactNode }) {
  return useCanWrite() ? <>{children}</> : null;
}
