import { describe, expect, it } from "vitest";
import { canMoveReturn, isOpenReturn, mayRequestReturn } from "@/lib/returns";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-09-11T12:00:00Z");
const delivered = (daysAgo: number) => ({
  status: "delivered",
  deliveredAt: new Date(now.getTime() - daysAgo * DAY),
});

describe("mayRequestReturn", () => {
  it("allows a delivered order inside the window with nothing in flight", () => {
    expect(mayRequestReturn(delivered(3), [], 14, now)).toEqual({ ok: true });
  });

  it("refuses an order that has not arrived", () => {
    expect(mayRequestReturn({ status: "shipped", deliveredAt: null }, [], 14, now)).toEqual({
      ok: false,
      reason: "not-delivered",
    });
  });

  it("closes on the day after the window", () => {
    expect(mayRequestReturn(delivered(14), [], 14, now).ok).toBe(true);
    expect(mayRequestReturn(delivered(15), [], 14, now)).toEqual({
      ok: false,
      reason: "window-closed",
    });
  });

  it("refuses while another request is open, and after one was refunded", () => {
    for (const status of ["requested", "approved", "received", "refunded"] as const) {
      expect(mayRequestReturn(delivered(1), [{ status }], 14, now).ok).toBe(false);
    }
  });

  it("allows a second ask after a rejection", () => {
    expect(mayRequestReturn(delivered(1), [{ status: "rejected" }], 14, now).ok).toBe(true);
  });

  it("is switched off by a window of zero", () => {
    expect(mayRequestReturn(delivered(1), [], 0, now)).toEqual({ ok: false, reason: "off" });
  });
});

describe("the return status line", () => {
  it("only moves forward", () => {
    expect(canMoveReturn("requested", "approved")).toBe(true);
    expect(canMoveReturn("requested", "rejected")).toBe(true);
    expect(canMoveReturn("approved", "received")).toBe(true);
    expect(canMoveReturn("received", "refunded")).toBe(true);

    expect(canMoveReturn("approved", "requested")).toBe(false);
    expect(canMoveReturn("received", "approved")).toBe(false);
    expect(canMoveReturn("requested", "received")).toBe(false);
  });

  it("ends at rejected and refunded", () => {
    expect(canMoveReturn("rejected", "approved")).toBe(false);
    expect(canMoveReturn("refunded", "received")).toBe(false);
  });

  it("knows which statuses are still the shop's problem", () => {
    expect(isOpenReturn("requested")).toBe(true);
    expect(isOpenReturn("received")).toBe(true);
    expect(isOpenReturn("rejected")).toBe(false);
    expect(isOpenReturn("refunded")).toBe(false);
  });
});
