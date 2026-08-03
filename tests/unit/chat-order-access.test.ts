import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who the assistant may read an order for.
 *
 * This is the only tool that touches customer data, so it is the only part of
 * the chat feature where a mistake leaks something. The model supplies an
 * order *number* and nothing else — identity comes from the request's cookies,
 * decided here — so these tests are about one question: can any sequence of
 * arguments get an order the caller doesn't own?
 *
 * Prisma, the session and the receipt cookie are all mocked. This is about the
 * authorisation rule, not the database.
 */

const findFirst = vi.fn();
const count = vi.fn();
const getCurrentUser = vi.fn();
const readReceipts = vi.fn();

/**
 * The whole Prisma surface the module could reach. Every mutating method is
 * present and will fail the test if it is ever called — the guarantee that a
 * conversation cannot change an order is worth asserting rather than trusting.
 */
const order = {
  findFirst: (...args: unknown[]) => findFirst(...args),
  count: (...args: unknown[]) => count(...args),
  create: vi.fn(),
  createMany: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: { order } }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/order-access", () => ({ readReceipts: () => readReceipts() }));

const { lookupOrder, callerHasOrders } = await import("@/lib/chat/order-lookup");

const SIGNED_IN = { id: "user_1", role: "customer" as const };
const ADMIN = { id: "user_admin", role: "admin" as const };

/** The row `findFirst` returns when the ownership clause does match. */
const ROW = {
  number: "BZ-1A2B3C",
  status: "shipped",
  paymentStatus: "unpaid",
  paymentMethod: "cash_on_delivery",
  createdAt: new Date("2026-07-30T10:00:00Z"),
  shippedAt: new Date("2026-08-01T10:00:00Z"),
  deliveredAt: null,
  city: "Tbilisi",
  total: 24_900,
  items: [{ nameKa: "ყურსასმენი", nameEn: "Headphones", quantity: 2, price: 12_450 }],
};

beforeEach(() => {
  findFirst.mockReset();
  count.mockReset();
  getCurrentUser.mockReset();
  readReceipts.mockReset();
  for (const method of [
    order.create,
    order.createMany,
    order.update,
    order.updateMany,
    order.upsert,
    order.delete,
    order.deleteMany,
  ]) {
    method.mockReset();
  }
});

/** The `OR` array the ownership clause was built from. */
function ownershipClause() {
  return findFirst.mock.calls[0]![0].where.OR;
}

describe("lookupOrder — authorisation", () => {
  it("refuses a stranger without querying the database at all", async () => {
    getCurrentUser.mockResolvedValue(null);
    readReceipts.mockResolvedValue([]);

    expect(await lookupOrder("BZ-1A2B3C", "ka")).toEqual({ found: false });
    // Not "queried and then filtered" — with no proof of ownership there is no
    // query, so a stranger's order never enters this process's memory.
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("scopes the query to the signed-in account", async () => {
    getCurrentUser.mockResolvedValue(SIGNED_IN);
    readReceipts.mockResolvedValue([]);
    findFirst.mockResolvedValue(ROW);

    await lookupOrder("BZ-1A2B3C", "ka");

    expect(ownershipClause()).toEqual([{ userId: "user_1" }]);
  });

  it("accepts the signed receipt cookie, so a guest can check their own order", async () => {
    getCurrentUser.mockResolvedValue(null);
    readReceipts.mockResolvedValue(["BZ-1A2B3C", "BZ-999"]);
    findFirst.mockResolvedValue(ROW);

    await lookupOrder("BZ-1A2B3C", "ka");

    expect(ownershipClause()).toEqual([{ number: { in: ["BZ-1A2B3C", "BZ-999"] } }]);
  });

  it("accepts either proof when both are present", async () => {
    getCurrentUser.mockResolvedValue(SIGNED_IN);
    readReceipts.mockResolvedValue(["BZ-777"]);
    findFirst.mockResolvedValue(ROW);

    await lookupOrder("BZ-1A2B3C", "ka");

    expect(ownershipClause()).toEqual([
      { userId: "user_1" },
      { number: { in: ["BZ-777"] } },
    ]);
  });

  it("gives an admin session no extra reach", async () => {
    getCurrentUser.mockResolvedValue(ADMIN);
    readReceipts.mockResolvedValue([]);
    findFirst.mockResolvedValue(null);

    await lookupOrder("BZ-SOMEONE-ELSE", "ka");

    // The order page lets an admin view any order; the chat deliberately does
    // not. Staff have the dashboard — a transcript must not become a second
    // way to read arbitrary customers' addresses.
    expect(ownershipClause()).toEqual([{ userId: "user_admin" }]);
  });

  it("reports an order that exists but isn't yours exactly like one that doesn't", async () => {
    getCurrentUser.mockResolvedValue(SIGNED_IN);
    readReceipts.mockResolvedValue([]);
    // The ownership clause didn't match, so nothing came back.
    findFirst.mockResolvedValue(null);

    // Identical to the "no such order" answer on purpose: telling the two
    // apart would make the chat an oracle for which order numbers are real.
    expect(await lookupOrder("BZ-1A2B3C", "ka")).toEqual({ found: false });
  });

  it("refuses an empty number without querying", async () => {
    getCurrentUser.mockResolvedValue(SIGNED_IN);
    readReceipts.mockResolvedValue([]);

    expect(await lookupOrder("   ", "ka")).toEqual({ found: false });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("normalises what the visitor typed", async () => {
    getCurrentUser.mockResolvedValue(SIGNED_IN);
    readReceipts.mockResolvedValue([]);
    findFirst.mockResolvedValue(ROW);

    await lookupOrder("  bz-1a2b3c  ", "ka");

    expect(findFirst.mock.calls[0]![0].where.number).toBe("BZ-1A2B3C");
  });
});

describe("lookupOrder — what it returns", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue(SIGNED_IN);
    readReceipts.mockResolvedValue([]);
    findFirst.mockResolvedValue(ROW);
  });

  it("formats money and dates for the locale, and counts the items", async () => {
    const result = await lookupOrder("BZ-1A2B3C", "en");
    if (!result.found) throw new Error("expected the order to be found");

    expect(result.total).toBe("₾249.00");
    expect(result.placedOn).toBe("30.07.2026");
    expect(result.shippedOn).toBe("01.08.2026");
    expect(result.deliveredOn).toBeNull();
    expect(result.itemCount).toBe(2);
    expect(result.items[0]!.name).toBe("Headphones");
    expect(result.url).toBe("/order/BZ-1A2B3C");
  });

  it("uses the Georgian product name and number format under ka", async () => {
    const result = await lookupOrder("BZ-1A2B3C", "ka");
    if (!result.found) throw new Error("expected the order to be found");

    expect(result.items[0]!.name).toBe("ყურსასმენი");
    // Non-breaking spaces, so a price never wraps mid-number.
    expect(result.total).toBe("249,00 ₾");
  });

  it("never returns a field that identifies the customer", async () => {
    const result = await lookupOrder("BZ-1A2B3C", "ka");
    if (!result.found) throw new Error("expected the order to be found");

    // The row has a city (needed to answer "where is it going?") but the name,
    // phone, email and street address are not selected at all — the assistant
    // has no reason for them, and anything it holds can end up in a transcript.
    for (const field of ["customerName", "phone", "email", "address", "userId"]) {
      expect(result).not.toHaveProperty(field);
    }
    expect(findFirst.mock.calls[0]![0].select).not.toHaveProperty("phone");
  });
});

describe("read-only guarantee", () => {
  it("cannot reach a single mutating Prisma method", async () => {
    getCurrentUser.mockResolvedValue(SIGNED_IN);
    readReceipts.mockResolvedValue(["BZ-777"]);
    findFirst.mockResolvedValue(ROW);
    count.mockResolvedValue(3);

    await lookupOrder("BZ-1A2B3C", "ka");
    await callerHasOrders();

    // The promise that a conversation can never change an order or move money
    // is enforced by there being no capability to do so, not by prompting.
    for (const method of [
      order.create,
      order.createMany,
      order.update,
      order.updateMany,
      order.upsert,
      order.delete,
      order.deleteMany,
    ]) {
      expect(method).not.toHaveBeenCalled();
    }
  });
});

describe("callerHasOrders", () => {
  it("is true on a receipt cookie alone, without a query", async () => {
    getCurrentUser.mockResolvedValue(null);
    readReceipts.mockResolvedValue(["BZ-777"]);

    expect(await callerHasOrders()).toBe(true);
    expect(count).not.toHaveBeenCalled();
  });

  it("is false for an anonymous visitor with no receipts", async () => {
    getCurrentUser.mockResolvedValue(null);
    readReceipts.mockResolvedValue([]);

    // Drives the prompt: with nothing to look up, "give me your order number"
    // is a dead end and the assistant should send them to /track instead.
    expect(await callerHasOrders()).toBe(false);
    expect(count).not.toHaveBeenCalled();
  });

  it("counts the account's orders when signed in", async () => {
    getCurrentUser.mockResolvedValue(SIGNED_IN);
    readReceipts.mockResolvedValue([]);
    count.mockResolvedValue(0);

    expect(await callerHasOrders()).toBe(false);
    expect(count).toHaveBeenCalledWith({ where: { userId: "user_1" } });

    count.mockResolvedValue(2);
    expect(await callerHasOrders()).toBe(true);
  });
});
