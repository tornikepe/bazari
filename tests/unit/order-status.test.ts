import { describe, expect, it } from "vitest";
import { isOrderStatus, ORDER_STATUSES } from "@/lib/order-status";

describe("isOrderStatus", () => {
  it("accepts every status in the lifecycle", () => {
    for (const status of ORDER_STATUSES) expect(isOrderStatus(status)).toBe(true);
  });

  it("lists the lifecycle in display order", () => {
    expect(ORDER_STATUSES).toEqual(["pending", "confirmed", "shipped", "delivered", "cancelled"]);
  });

  it("rejects anything else", () => {
    // `updateOrderStatus` is a Server Action, so this value can be anything a
    // POST body contains.
    for (const value of ["", "Pending", "refunded", "'; DROP TABLE", null, 0, []]) {
      expect(isOrderStatus(value)).toBe(false);
    }
  });
});
