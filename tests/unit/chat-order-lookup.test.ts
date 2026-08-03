import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The one tool that touches customer data.
 *
 * The assistant passes an order number; nothing about *whose* order it is
 * comes from the model. These tests pin that: the ownership clause is built
 * from the request's own cookies, and with no proof of ownership the database
 * is never asked at all.
 *
 * Prisma, the session and the receipt cookie are mocked — this is about the
 * authorisation rule, not about SQL.
 */
const findFirst = vi.fn();
const count = vi.fn();
const getCurrentUser = vi.fn();
const readReceipts = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      count: (...args: unknown[]) => count(...args),
    },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/lib/order-access", () => ({ readReceipts: () => readReceipts() }));

const { lookupOrder, callerHasOrders } = await import("@/lib/chat/order-lookup");

const ORDER = {
  number: "BZ-1A2B3C",
  status: "shipped",
  paymentStatus: "unpaid",
  paymentMethod: "cash_on_delivery",
  createdAt: new Date("2026-07-30T09:00:00Z"),
  shippedAt: new Date("2026-08-01T09:00:00Z"),
  deliveredAt: null,
  city: "Tbilisi",
  total: 24_900,
  items: [{ nameKa: "ყურსასმენი", nameEn: "Headphones", quantity: 2, price: 9_950 }],
};

beforeEach(() => {
  findFirst.mockReset();
  count.mockReset();
  getCurrentUser.mockReset().mockResolvedValue(null);
  readReceipts.mockReset().mockResolvedValue([]);
});

describe("lookupOrder", () => {
  it("does not query at all without a proof of ownership", async () => {
    // No account and no receipt cookie: there is no order this caller could
    // be entitled to, so the number is never even looked up.
    expect(await lookupOrder("BZ-1A2B3C", "en")).toEqual({ found: false });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("scopes the query to the signed-in user's own orders", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", role: "customer" });
    findFirst.mockResolvedValue(ORDER);

    await lookupOrder("BZ-1A2B3C", "en");

    const where = findFirst.mock.calls[0]![0].where;
    expect(where.number).toBe("BZ-1A2B3C");
    expect(where.OR).toEqual([{ userId: "user-1" }]);
  });

  it("accepts the signed receipt cookie, so a guest can check their own order", async () => {
    readReceipts.mockResolvedValue(["BZ-1A2B3C", "BZ-9Z8Y7X"]);
    findFirst.mockResolvedValue(ORDER);

    await lookupOrder("bz-1a2b3c", "en");

    const where = findFirst.mock.calls[0]![0].where;
    // Order numbers are upper-case; the caller types whatever they type.
    expect(where.number).toBe("BZ-1A2B3C");
    expect(where.OR).toEqual([{ number: { in: ["BZ-1A2B3C", "BZ-9Z8Y7X"] } }]);
  });

  it("gives an admin session no privilege here", async () => {
    // The order page lets staff through; the chat deliberately does not. A
    // transcript must not become a second way to read arbitrary addresses.
    getCurrentUser.mockResolvedValue({ id: "admin-1", role: "admin" });
    findFirst.mockResolvedValue(null);

    expect(await lookupOrder("BZ-1A2B3C", "en")).toEqual({ found: false });

    const where = findFirst.mock.calls[0]![0].where;
    expect(where.OR).toEqual([{ userId: "admin-1" }]);
  });

  it("reports someone else's real order exactly like a made-up one", async () => {
    // Distinguishing the two would turn the chat into an oracle for which
    // order numbers exist.
    getCurrentUser.mockResolvedValue({ id: "user-1", role: "customer" });
    findFirst.mockResolvedValue(null);

    expect(await lookupOrder("BZ-SOMEONE-ELSE", "en")).toEqual({ found: false });
    expect(await lookupOrder("BZ-DOES-NOT-EXIST", "en")).toEqual({ found: false });
  });

  it("rejects an empty number without a query", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", role: "customer" });

    expect(await lookupOrder("   ", "en")).toEqual({ found: false });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns only what a status answer needs", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", role: "customer" });
    findFirst.mockResolvedValue(ORDER);

    const result = await lookupOrder("BZ-1A2B3C", "en");
    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result).toMatchObject({
      number: "BZ-1A2B3C",
      status: "shipped",
      placedOn: "30.07.2026",
      shippedOn: "01.08.2026",
      deliveredOn: null,
      total: "₾249.00",
      itemCount: 2,
      url: "/order/BZ-1A2B3C",
    });

    // The name, phone, email and street address are never selected, so they
    // cannot end up in a transcript even for the order's own owner.
    for (const field of ["customerName", "phone", "email", "address", "note"]) {
      expect(result).not.toHaveProperty(field);
    }
    expect(findFirst.mock.calls[0]![0].select).not.toHaveProperty("phone");
    expect(findFirst.mock.calls[0]![0].select).not.toHaveProperty("address");
  });

  it("renders the item names and money in the asked-for language", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", role: "customer" });
    findFirst.mockResolvedValue(ORDER);

    const result = await lookupOrder("BZ-1A2B3C", "ka");
    if (!result.found) throw new Error("expected the order to be found");

    expect(result.items[0]!.name).toBe("ყურსასმენი");
    // Georgian puts the symbol last, and uses a non-breaking space.
    expect(result.total).toBe("249,00 ₾");
  });
});

describe("callerHasOrders", () => {
  it("is true when the browser holds a receipt", async () => {
    readReceipts.mockResolvedValue(["BZ-1A2B3C"]);
    expect(await callerHasOrders()).toBe(true);
    expect(count).not.toHaveBeenCalled();
  });

  it("is false for an anonymous visitor with no receipts", async () => {
    expect(await callerHasOrders()).toBe(false);
    expect(count).not.toHaveBeenCalled();
  });

  it("counts only the signed-in user's own orders", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", role: "customer" });
    count.mockResolvedValue(0);

    expect(await callerHasOrders()).toBe(false);
    expect(count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});
