"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  homeFor,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = { error?: "invalid" | "taken" | "weak" | "failed" };

const MIN_PASSWORD_LENGTH = 8;

/**
 * One sign-in form for everyone. The account's role decides where they land:
 * staff go to the admin dashboard, customers to their own account area.
 *
 * `useActionState` signature. Returns instead of throwing so the form can show
 * the message inline, and never reveals which of the two fields was wrong.
 */
export async function login(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "invalid" };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.password)) {
    return { error: "invalid" };
  }

  await createSession(user.id);
  redirect(homeFor(user.role));
}

/** Customer sign-up. Staff accounts are only created by seeding. */
export async function register(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!email || !email.includes("@") || !name) return { error: "invalid" };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak" };

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "taken" };

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        password: hashPassword(password),
        // Never taken from the form — sign-up cannot mint an admin.
        role: "customer",
      },
    });
  } catch (error) {
    console.error("register failed", error);
    return { error: "failed" };
  }

  await createSession(user.id);
  redirect("/account");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

/** Updates the signed-in customer's saved delivery details. */
export async function updateProfile(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "invalid" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "invalid" };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        phone: String(formData.get("phone") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim(),
        address: String(formData.get("address") ?? "").trim(),
      },
    });
  } catch (error) {
    console.error("updateProfile failed", error);
    return { error: "failed" };
  }

  redirect("/account?saved=1");
}
