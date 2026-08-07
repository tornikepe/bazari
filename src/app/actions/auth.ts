"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { consumeCode, issueCode } from "@/lib/verification";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/auth-emails";
import { getLocale } from "@/lib/locale";
import { clientIp, consume, reset } from "@/lib/rate-limit";
import {
  createSession,
  revokeSessions,
  destroySession,
  getCurrentUser,
  hashPassword,
  homeFor,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = {
  error?:
    | "invalid"
    | "taken"
    | "weak"
    | "failed"
    | "mismatch"
    | "expired"
    | "too-many-attempts"
    | "rate-limited";
  sent?: boolean;
  /** Minutes until a rate-limited caller may retry. */
  retryMinutes?: number;
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

  // Per IP *and* per email: the first stops one host spraying many accounts,
  // the second stops a botnet grinding one account.
  const ip = await clientIp();
  for (const key of [`login:ip:${ip}`, `login:email:${email}`]) {
    const limit = await consume(key, 5, 15 * 60);
    if (!limit.ok) {
      return { error: "rate-limited", retryMinutes: Math.ceil(limit.retryAfter / 60) };
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.password)) {
    return { error: "invalid" };
  }

  // A correct password clears the counters, so yesterday's typos don't count.
  await reset(`login:ip:${ip}`);
  await reset(`login:email:${email}`);

  await createSession(user.id, user.sessionVersion);
  redirect(safeNext(formData.get("next")) ?? homeFor(user.role));
}

/**
 * Where to send someone after signing in, when the form asked for somewhere
 * specific — "you have to sign in to check out" should return to checkout, not
 * to the account page.
 *
 * Only same-origin paths are allowed through, and only ones starting with a
 * single slash. `//evil.example` is a protocol-relative URL that browsers
 * treat as another origin, so a bare `startsWith("/")` check is not enough.
 * An unvalidated `next` is an open redirect, and this value arrives in the URL
 * where anybody can put anything in it.
 */
function safeNext(value: FormDataEntryValue | null): string | null {
  const next = typeof value === "string" ? value.trim() : "";
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
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
  await createSession(user.id, user.sessionVersion);

  const { code } = await issueCode(user.id, "email_verification");
  // Emailed, never placed in the URL — a code in the query string survives in
  // browser history, server logs and the Referer header.
  await sendVerificationEmail(email, code, await getLocale());

  redirect(`/verify?email=${encodeURIComponent(email)}`);
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

  for (const [key, limit] of [
    [`resend:email:${email}`, 3],
    [`resend:ip:${await clientIp()}`, 10],
  ] as const) {
    const result = await consume(key, limit, 60 * 60);
    if (!result.ok) {
      return { error: "rate-limited", retryMinutes: Math.ceil(result.retryAfter / 60) };
    }
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Always reports success: telling an anonymous caller whether an address is
  // registered would leak the user list.
  if (!user) return { sent: true };

  const { code } = await issueCode(user.id, "email_verification");
  await sendVerificationEmail(email, code, await getLocale());

  return { sent: true };
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

  // Checked before the user lookup so the limit applies to unknown addresses
  // too — otherwise the throttle itself reveals which accounts exist.
  for (const [key, limit] of [
    [`reset:email:${email}`, 3],
    [`reset:ip:${await clientIp()}`, 10],
  ] as const) {
    const result = await consume(key, limit, 60 * 60);
    if (!result.ok) {
      return { error: "rate-limited", retryMinutes: Math.ceil(result.retryAfter / 60) };
    }
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  // Same response whether or not the address exists — otherwise this endpoint
  // becomes a way to enumerate accounts.
  if (!user) return { sent: true };

  const { code } = await issueCode(user.id, "password_reset");
  await sendPasswordResetEmail(email, code, await getLocale());

  // Same shape as the "no such user" branch above, and deliberately says
  // nothing about whether delivery actually succeeded.
  return { sent: true };
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

  // Every session issued before this moment stops working, including any the
  // attacker is holding. This is the whole point of resetting a password when
  // you think somebody is in your account, and until now it did not happen:
  // the old cookie stayed valid for its full seven days.
  //
  // It logs out this browser too, which is why a fresh session is minted
  // immediately afterwards at the new version.
  const version = await revokeSessions(result.userId);
  await createSession(result.userId, version);
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
