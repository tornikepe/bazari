"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";

export type LoginState = { error?: "invalid" };

/**
 * `useActionState` signature. Returns instead of throwing so the form can show
 * the message inline, and never says *which* of the two fields was wrong.
 */
export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "invalid" };

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !verifyPassword(password, admin.password)) {
    return { error: "invalid" };
  }

  await createSession(admin.id);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
