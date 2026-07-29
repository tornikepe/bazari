import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth-hash";

describe("password hashing", () => {
  it("accepts the correct password", () => {
    expect(verifyPassword("correct horse", hashPassword("correct horse"))).toBe(true);
  });

  it("rejects the wrong password", () => {
    expect(verifyPassword("wrong", hashPassword("correct horse"))).toBe(false);
  });

  it("never stores the password itself", () => {
    expect(hashPassword("hunter2")).not.toContain("hunter2");
  });

  it("salts, so the same password hashes differently every time", () => {
    // Without this an attacker can spot shared passwords across accounts.
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("is case-sensitive", () => {
    expect(verifyPassword("Password", hashPassword("password"))).toBe(false);
  });

  it("does not treat a prefix as a match", () => {
    expect(verifyPassword("pass", hashPassword("password"))).toBe(false);
  });

  it("survives a malformed stored value instead of throwing", () => {
    // A truncated column must fail closed, not crash the sign-in route.
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "no-colon")).toBe(false);
    expect(verifyPassword("x", "salt:")).toBe(false);
  });

  it("handles unicode and long passwords", () => {
    const long = "პაროლი-".repeat(20);
    expect(verifyPassword(long, hashPassword(long))).toBe(true);
  });
});
