"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { consumeCode, consumeInvite, issueCode } from "@/lib/verification";
import { sendPasswordResetEmail, sendStaffLoginEmail, sendVerificationEmail } from "@/lib/auth-emails";
import { mailConfigured } from "@/lib/mail";
import { getLocale } from "@/lib/locale";
import { clientIp, consume, reset } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";
import {
  createSession,
  revokeSessions,
  destroySession,
  getCurrentUser,
  hashPassword,
  homeFor,
  isStaff,
  verifyPassword,
} from "@/lib/auth";

export type AuthState = {
  error?:
    | "invalid"
    | "taken"
    | "phone"
    | "phone-taken"
    | "weak"
    | "failed"
    | "mismatch"
    | "expired"
    | "too-many-attempts"
    | "rate-limited"
    /* The shop has no mail provider configured, so no code can be sent to
       anybody. Never says anything about a particular address. */
    | "mail-unavailable"
    /* The account page's password change: the current one was not right. */
    | "wrong-password";
  sent?: boolean;
  /** Minutes until a rate-limited caller may retry. */
  retryMinutes?: number;
  /**
   * The password was right and the account is staff, so the form must now
   * ask for the code that went to the address on it. The address is echoed
   * back only because the second step has to name it; it is never a value
   * the form can set, so it cannot be used to sign in as somebody else.
   */
  staffCode?: { email: string };
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
  // The address, or the phone: whichever was typed. A phone is normalised
  // to the one shape the shop stores before it is looked up, so "555 12 34
  // 56", "+995555123456" and "0555123456" all find the same account.
  const identifier = String(formData.get("email") ?? formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const email = identifier.includes("@") ? identifier.toLowerCase() : "";
  const phone = email ? null : normalizePhone(identifier);

  if ((!email && !phone) || !password) return { error: "invalid" };

  // Per IP *and* per account: the first stops one host spraying many
  // accounts, the second stops a botnet grinding one account.
  const ip = await clientIp();
  const who = email || phone!;
  for (const key of [`login:ip:${ip}`, `login:email:${who}`]) {
    const limit = await consume(key, 5, 15 * 60);
    if (!limit.ok) {
      return { error: "rate-limited", retryMinutes: Math.ceil(limit.retryAfter / 60) };
    }
  }

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ where: { phone: phone!, role: "customer" } });
  if (!user || !verifyPassword(password, user.password)) {
    return { error: "invalid" };
  }

  /* A switched-off account is refused *after* the password is checked and
     with the same message a wrong password gets. Answering "this account is
     disabled" to anyone who types an address would turn the form into a way
     to find out who works here — and answering it before the password check
     would do so without even needing to guess one. */
  if (user.disabledAt) return { error: "invalid" };

  // A correct password clears the counters, so yesterday's typos don't count.
  await reset(`login:ip:${ip}`);
  await reset(`login:email:${who}`);

  /* Staff get a second step: the password is one half, a code sent to the
     address on the account is the other. The dashboard can reprice the
     shop, read every customer's address and empty the stockroom, and a
     password is one leaked note away from anybody.
     
     Only when the shop can actually send email. If it cannot, there is no
     code to type and insisting on one would lock the owner out of their
     own shop — the fallback is the password alone, and the dashboard says
     so until a mail key is set. Nothing an attacker does can turn the
     mailer off; only the deployment's own configuration can. */
  if (isStaff(user.role) && mailConfigured()) {
    const { code } = await issueCode(user.id, "staff_login");
    await sendStaffLoginEmail(user.email, code, await getLocale());
    return { staffCode: { email: user.email } };
  }

  await createSession(user.id, user.sessionVersion);
  redirect(safeNext(formData.get("next")) ?? homeFor(user.role));
}

/**
 * The second half of a staff sign-in.
 *
 * The code is the only thing this takes on trust, and it is six digits, so
 * it is metered twice over: `consumeCode` locks the code itself after five
 * wrong tries, and the address is counted here so a caller cannot simply
 * ask for a fresh code and start again. Everything about the account is
 * checked a second time — staff still, not disabled — because minutes have
 * passed since the password was.
 */
export async function confirmStaffSignIn(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  if (!email || !code) return { error: "invalid" };

  const ip = await clientIp();
  for (const key of [`staffcode:ip:${ip}`, `staffcode:email:${email}`]) {
    const limit = await consume(key, 10, 30 * 60);
    if (!limit.ok) {
      return { error: "rate-limited", retryMinutes: Math.ceil(limit.retryAfter / 60) };
    }
  }

  const result = await consumeCode(email, "staff_login", code);
  if (!result.ok) {
    return { error: result.reason === "invalid" ? "invalid" : result.reason };
  }

  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { id: true, role: true, sessionVersion: true, disabledAt: true },
  });
  if (!user || !isStaff(user.role) || user.disabledAt) return { error: "invalid" };

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
  // Required, and a Georgian mobile: it is how the courier calls, and it
  // is a way to sign in. Kept in the one shape every number is kept in.
  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!email || !email.includes("@") || !name) return { error: "invalid" };
  if (!phone) return { error: "phone" };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak" };
  if (password !== confirm) return { error: "mismatch" };

  /* Signing up costs the shop an email and a row. Unmetered, one host can
     make a thousand accounts in a minute — and every one of them sends a
     verification code, which is somebody else's inbox if the address is
     not theirs. Five an hour from one address is generous for a person. */
  const signUps = await consume(`register:ip:${await clientIp()}`, 5, 60 * 60);
  if (!signUps.ok) {
    return { error: "rate-limited", retryMinutes: Math.ceil(signUps.retryAfter / 60) };
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "taken" };
  // One account per number, or a login by phone could not know which.
  const samePhone = await prisma.user.findFirst({ where: { phone, role: "customer" }, select: { id: true } });
  if (samePhone) return { error: "phone-taken" };

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
  const sent = await sendVerificationEmail(email, code, await getLocale());

  /* Whether it actually went out, so the next page can stop telling people to
     check an inbox nothing was sent to. Only ever "0": the flag says the send
     failed, and its absence claims nothing. */
  const failed = sent ? "" : "&sent=0";
  redirect(`/verify?email=${encodeURIComponent(email)}${failed}`);
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

  /* Answered before the lookup and without reference to the address: "this
     shop cannot send email" is safe to tell anybody, where "nothing was sent
     to you" would answer a question about who has an account here. */
  if (!mailConfigured()) return { error: "mail-unavailable" };

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

  // Same reasoning as the resend above: a deployment with no mail provider
  // cannot send this code to anyone, and saying so reveals nothing about who
  // has an account. Without it the page promises a letter that never comes.
  if (!mailConfigured()) return { error: "mail-unavailable" };

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

/* ------------------------------------------------------------------ */
/* The account page: three things change on their own, in place          */
/* ------------------------------------------------------------------ */

/**
 * The mobile number, on its own. The one shape every number is kept in;
 * one account per number, or a sign-in by phone could not know which.
 */
export async function updatePhone(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "invalid" };

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "phone" };

  const samePhone = await prisma.user.findFirst({
    where: { phone, role: "customer", NOT: { id: user.id } },
    select: { id: true },
  });
  if (samePhone) return { error: "phone-taken" };

  try {
    await prisma.user.update({ where: { id: user.id }, data: { phone } });
  } catch (error) {
    console.error("updatePhone failed", error);
    return { error: "failed" };
  }
  redirect("/account?saved=phone");
}

/**
 * The address, on its own. A new address is unverified until its code is
 * entered — the same door registration goes through — so the page that
 * follows is the verification page, with the code already on its way.
 */
export async function updateEmail(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "invalid" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "invalid" };
  if (email === user.email) redirect("/account");

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "taken" };

  try {
    await prisma.user.update({ where: { id: user.id }, data: { email, emailVerified: false } });
  } catch (error) {
    console.error("updateEmail failed", error);
    return { error: "failed" };
  }

  const { code } = await issueCode(user.id, "email_verification");
  const sent = await sendVerificationEmail(email, code, await getLocale());
  redirect(`/verify?email=${encodeURIComponent(email)}${sent ? "" : "&sent=0"}`);
}

/**
 * The password, on its own: the current one has to be typed first, so a
 * browser left open cannot have its password changed by whoever sits down
 * at it. Every other session stops working, as after a reset.
 */
export async function changePassword(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const user = await getCurrentUser();
  if (!user) return { error: "invalid" };

  const current = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak" };
  if (password !== confirm) return { error: "mismatch" };

  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { password: true } });
  if (!row || !verifyPassword(current, row.password)) return { error: "wrong-password" };

  try {
    await prisma.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } });
  } catch (error) {
    console.error("changePassword failed", error);
    return { error: "failed" };
  }

  const version = await revokeSessions(user.id);
  await createSession(user.id, version);
  redirect("/account?saved=password");
}

/**
 * A new password for a staff account, made by the shop rather than by the
 * person using it.
 *
 * The one the dashboard shipped with came out of a seed script and lives
 * in a file on somebody's disk; the one a person invents is a word they
 * already use somewhere else. This makes twenty characters out of the
 * system's random source, sets it, and hands it back exactly once — after
 * that it exists only as a hash, and nobody, including this shop, can read
 * it again.
 *
 * Every other session is cut at the same moment, and the caller's own is
 * reissued, so rotating a password that may have leaked actually removes
 * whoever was using it.
 *
 * The plain text is returned to the caller over the same TLS connection
 * that carried their session and is never written to a log or a column.
 */
export async function generateStaffPassword(): Promise<
  { ok: true; password: string } | { ok: false }
> {
  const user = await getCurrentUser();
  if (!user || !isStaff(user.role)) return { ok: false };

  /* An alphabet with no 0/O and no 1/l/I in it: this is read off a screen
     and typed, or read down a phone. Four groups of five, which is a
     shape people copy without losing their place. */
  const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(20);
  const chars = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]);
  const password = [0, 5, 10, 15].map((at) => chars.slice(at, at + 5).join("")).join("-");

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashPassword(password) },
    });
  } catch (error) {
    console.error("generateStaffPassword failed", error);
    return { ok: false };
  }

  // Everything else signed out, this session kept.
  const version = await revokeSessions(user.id);
  await createSession(user.id, version);

  await audit({
    actor: user.email,
    action: "staff.password",
    entityId: user.id,
    label: user.email,
  });

  return { ok: true, password };
}

/**
 * The two consents, saved the moment a box is ticked — there is no form
 * around them to submit.
 */
export async function updateConsent(key: "smsOptIn" | "emailOptIn", value: boolean) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };
  try {
    await prisma.user.update({ where: { id: user.id }, data: { [key]: value } });
    return { ok: true as const };
  } catch (error) {
    console.error("updateConsent failed", error);
    return { ok: false as const };
  }
}

/**
 * Accepts a staff invitation: the invitee chooses their own password.
 *
 * The account already exists with a password nobody knows, so this is not a
 * reset — there is nothing to reset from. The token is the whole
 * authorisation, which is why it is 256 bits, single-use and short-lived, and
 * why it is spent before the password is written rather than after: a request
 * that fails halfway must not leave a link that still works.
 */
export async function acceptInvite(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak" };
  if (password !== confirm) return { error: "mismatch" };

  const userId = await consumeInvite(token);
  if (!userId) return { error: "expired" };

  let user;
  try {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashPassword(password),
        /* Following the link proves the address receives mail, which is the
           same thing the six-digit code proves. Asking them to confirm it
           again afterwards would be asking twice. */
        emailVerified: true,
        disabledAt: null,
        // Nothing was signed in before this; the bump is for the case where
        // an existing account was promoted into a role.
        sessionVersion: { increment: 1 },
      },
      select: { id: true, role: true, sessionVersion: true },
    });
  } catch (error) {
    console.error("acceptInvite failed", error);
    return { error: "failed" };
  }

  await createSession(user.id, user.sessionVersion);
  redirect(homeFor(user.role));
}
