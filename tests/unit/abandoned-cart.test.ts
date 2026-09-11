import { describe, expect, it } from "vitest";
import { isDueForReminder } from "@/lib/abandoned-cart-rules";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-09-12T12:00:00Z");
const touched = (hoursAgo: number) => ({
  updatedAt: new Date(now.getTime() - hoursAgo * HOUR),
  remindedAt: null,
});

describe("isDueForReminder", () => {
  it("waits a day", () => {
    expect(isDueForReminder(touched(23), null, now)).toBe(false);
    expect(isDueForReminder(touched(24), null, now)).toBe(true);
  });

  it("gives up after a week", () => {
    expect(isDueForReminder(touched(24 * 7), null, now)).toBe(true);
    expect(isDueForReminder(touched(24 * 7 + 1), null, now)).toBe(false);
  });

  it("writes once", () => {
    expect(isDueForReminder({ ...touched(30), remindedAt: new Date() }, null, now)).toBe(false);
  });

  it("stays quiet when they bought since", () => {
    const cart = touched(30);
    const boughtAfter = new Date(cart.updatedAt.getTime() + HOUR);
    const boughtBefore = new Date(cart.updatedAt.getTime() - HOUR);
    expect(isDueForReminder(cart, boughtAfter, now)).toBe(false);
    expect(isDueForReminder(cart, boughtBefore, now)).toBe(true);
  });
});
