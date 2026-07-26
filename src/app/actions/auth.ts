"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { consumeCode, issueCode } from "@/lib/verification";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  homeFor,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = {
  error?: "invalid" | "taken" | "weak" | "failed" | "mismatch" | "expired" | "too-many-attempts";
  /** Demo only — see `issueCode`. Lets the UI show the code that was "sent". */
  demoCode?: string;
  sent?: boolean;
};

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

  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!email || !email.includes("@") || !name) return { error: "invalid" };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak" };
  if (password !== confirm) return { error: "mismatch" };

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

  // Signed in immediately, but flagged unverified until the code is entered —
  // the account works, the badge in the header says it still needs confirming.
  await createSession(user.id);

  const { code } = await issueCode(user.id, "email_verification");
  redirect(`/verify?email=${encodeURIComponent(email)}&code=${code}`);
}

/* ------------------------------------------------------------------ */
/* Email verification                                                  */
/* ------------------------------------------------------------------ */

/** Confirms the emailed code and marks the address verified. */
export async function verifyEmail(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "");

  const result = await consumeCode(email, "email_verification", code);
  if (!result.ok) {
    return { error: result.reason === "invalid" ? "invalid" : result.reason };
  }

  await prisma.user.update({
    where: { id: result.userId },
    data: { emailVerified: true },
  });

  redirect("/account?verified=1");
}

/** Re-sends a verification code to an address that hasn't confirmed yet. */
export async function resendVerification(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Always reports success: telling an anonymous caller whether an address is
  // registered would leak the user list.
  if (!user) return { sent: true };

  const { code } = await issueCode(user.id, "email_verification");
  return { sent: true, demoCode: code };
}

/* ------------------------------------------------------------------ */
/* Password reset                                                      */
/* ------------------------------------------------------------------ */

/** Step 1 — request a reset code. */
export async function requestPasswordReset(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "invalid" };

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Same response whether or not the address exists — otherwise this endpoint
  // becomes a way to enumerate accounts.
  if (!user) return { sent: true };

  const { code } = await issueCode(user.id, "password_reset");
  return { sent: true, demoCode: code };
}

/** Step 2 — exchange the code for a new password. */
export async function resetPassword(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak" };
  if (password !== confirm) return { error: "mismatch" };

  const result = await consumeCode(email, "password_reset", code);
  if (!result.ok) {
    return { error: result.reason === "invalid" ? "invalid" : result.reason };
  }

  await prisma.user.update({
    where: { id: result.userId },
    // A successful reset proves control of the mailbox.
    data: { password: hashPassword(password), emailVerified: true },
  });

  // Every existing session is left as-is by design: this demo has no session
  // store to revoke. In production this is where they would be invalidated.
  await createSession(result.userId);
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
