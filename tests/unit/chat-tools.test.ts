import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Whether a tool result can be mistaken for a fact about the shop.
 *
 * This exists because of a real answer given to a real visitor: the database
 * was refusing connections, and the assistant told them the shop had no
 * headphones. It has plenty. The lookup had simply never run — but the failure
 * came back as a sentence, the model paraphrased the sentence, and a technical
 * outage turned into a false claim about the catalogue.
 *
 * So the distinction between "there are none" and "I couldn't look" is now a
 * `status` field rather than prose, and these tests are what keep it one.
 */

const searchProducts = vi.fn();
const getProductBySlug = vi.fn();
const listCategories = vi.fn();
const lookupOrder = vi.fn();

vi.mock("@/lib/chat/retrieval", () => ({
  searchProducts: (...a: unknown[]) => searchProducts(...a),
  getProductBySlug: (...a: unknown[]) => getProductBySlug(...a),
  listCategories: (...a: unknown[]) => listCategories(...a),
}));
vi.mock("@/lib/chat/order-lookup", () => ({
  lookupOrder: (...a: unknown[]) => lookupOrder(...a),
}));

const { runChatTool, CHAT_TOOLS, isChatToolName } = await import("@/lib/chat/tools");

const MATCH = {
  name: "QCY T13 ANC",
  slug: "qcy-t13",
  url: "/product/qcy-t13",
  brand: "QCY",
  price: "₾89.00",
  oldPrice: null,
  inStock: true,
  stock: 4,
  shippingDays: 14,
  category: "Audio",
};

async function run(name: string, args: Record<string, unknown> = {}) {
  return JSON.parse(await runChatTool(name, args, "en")) as {
    status: string;
    note?: string;
    [key: string]: unknown;
  };
}

beforeEach(() => {
  searchProducts.mockReset();
  getProductBySlug.mockReset();
  listCategories.mockReset();
  lookupOrder.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("status: found vs absent vs unavailable", () => {
  it("reports ok with the matches", async () => {
    searchProducts.mockResolvedValue([MATCH]);

    const out = await run("search_products", { query: "headphones" });

    expect(out.status).toBe("ok");
    expect(out.matches).toEqual([MATCH]);
  });

  it("reports empty when the catalogue really has nothing", async () => {
    searchProducts.mockResolvedValue([]);

    const out = await run("search_products", { query: "submarine" });

    expect(out.status).toBe("empty");
    // Empty is not the end of it: Georgian declines its nouns, so a plural the
    // visitor typed can miss a singular in the catalogue.
    expect(out.note).toMatch(/shorter or more general/i);
  });

  it("reports unavailable — never empty — when the lookup itself fails", async () => {
    searchProducts.mockRejectedValue(new Error("TooManyConnections"));

    const out = await run("search_products", { query: "headphones" });

    // The distinction the whole file exists for.
    expect(out.status).toBe("unavailable");
    expect(out.status).not.toBe("empty");
  });

  it("forbids, in the result itself, turning an outage into a stock claim", async () => {
    searchProducts.mockRejectedValue(new Error("connection refused"));

    const out = await run("search_products", { query: "headphones" });

    expect(out.note).toMatch(/NOTHING about the catalogue/);
    expect(out.note).toMatch(/Do NOT say the shop has no such product/);
    expect(out.note).toMatch(/out of stock/);
  });

  it("never leaks the underlying error to the model", async () => {
    // A stack trace or a connection string in a tool result is one paraphrase
    // away from being read out to a customer.
    searchProducts.mockRejectedValue(
      new Error("connect ECONNREFUSED postgres://user:hunter2@db.internal:5432"),
    );

    const out = await run("search_products", { query: "headphones" });

    expect(JSON.stringify(out)).not.toMatch(/ECONNREFUSED|hunter2|postgres:\/\//);
  });
});

describe("every tool distinguishes the three cases", () => {
  it("get_product", async () => {
    getProductBySlug.mockResolvedValue({ ...MATCH, sku: "X", description: "d" });
    expect((await run("get_product", { slug: "qcy-t13" })).status).toBe("ok");

    getProductBySlug.mockResolvedValue(null);
    expect((await run("get_product", { slug: "nope" })).status).toBe("empty");

    getProductBySlug.mockRejectedValue(new Error("down"));
    expect((await run("get_product", { slug: "qcy-t13" })).status).toBe("unavailable");
  });

  it("list_categories", async () => {
    listCategories.mockResolvedValue([{ name: "Audio", url: "/catalog?category=audio", products: 5 }]);
    expect((await run("list_categories")).status).toBe("ok");

    listCategories.mockRejectedValue(new Error("down"));
    expect((await run("list_categories")).status).toBe("unavailable");
  });

  it("lookup_order", async () => {
    lookupOrder.mockResolvedValue({ found: true, number: "BZ-1" });
    expect((await run("lookup_order", { order_number: "BZ-1" })).status).toBe("ok");

    lookupOrder.mockResolvedValue({ found: false });
    const absent = await run("lookup_order", { order_number: "BZ-9" });
    expect(absent.status).toBe("empty");
    // Not-found must stay incurious: explaining *why* would turn the chat into
    // an oracle for which order numbers are real.
    expect(absent.note).toMatch(/Do not speculate/i);

    lookupOrder.mockRejectedValue(new Error("down"));
    const broken = await run("lookup_order", { order_number: "BZ-1" });
    expect(broken.status).toBe("unavailable");
    expect(broken.note).toMatch(/order does not exist/);
  });

  it("an unknown tool name is unavailable, not empty", async () => {
    expect((await run("delete_order", { id: "1" })).status).toBe("unavailable");
  });
});

describe("the tool surface itself", () => {
  it("offers exactly four tools, and every one of them only reads", async () => {
    expect(CHAT_TOOLS.map((tool) => tool.name).sort()).toEqual([
      "get_product",
      "list_categories",
      "lookup_order",
      "search_products",
    ]);

    // The guarantee that a conversation cannot change an order or move money
    // rests on this list. A tool whose name suggests writing would be a bug
    // long before the model ever called it.
    for (const tool of CHAT_TOOLS) {
      expect(tool.name).not.toMatch(/create|update|delete|cancel|refund|set|pay|send/i);
    }
  });

  it("recognises its own tools and nothing else", () => {
    expect(isChatToolName("search_products")).toBe(true);
    expect(isChatToolName("cancel_order")).toBe(false);
  });
});
