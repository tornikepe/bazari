import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import {
  getProductBySlug,
  listCategories,
  searchProducts,
} from "@/lib/chat/retrieval";
import { lookupOrder } from "@/lib/chat/order-lookup";
import { MAX_MESSAGE_LENGTH, type ChatToolName } from "@/lib/chat/config";
import type { Locale } from "@/lib/i18n";

/**
 * The assistant's entire reach into the application.
 *
 * Four tools, all reads. There is deliberately no tool that writes: no cart
 * mutation, no order change, no refund, no email. The guarantee that a chat
 * conversation cannot alter an order or move money is enforced here, by the
 * absence of any capability to do so — not by asking the model nicely.
 *
 * `strict: true` on every schema means the API validates the arguments before
 * they reach this process, so the handlers below can trust their shapes.
 */
export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_products",
    description:
      "Search the live product catalogue by free text (product name, brand or description). " +
      "Returns up to six matches with the current price and stock level. " +
      "Use this for any question about what is sold, what it costs or whether it is available.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "What to look for. A product name, a brand, or a plain description of the kind of thing wanted.",
        },
        category_slug: {
          type: ["string", "null"],
          description:
            "Optional category slug to narrow the search, exactly as listed in the shop facts.",
        },
        in_stock_only: {
          type: ["boolean", "null"],
          description: "Set true to exclude products that are out of stock.",
        },
      },
      required: ["query", "category_slug", "in_stock_only"],
      additionalProperties: false,
    },
  },
  {
    name: "get_product",
    description:
      "Full detail for one product, by its slug. Use after a search when the person asks about a specific item.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "The product slug, as returned by search_products.",
        },
      },
      required: ["slug"],
      additionalProperties: false,
    },
  },
  {
    name: "list_categories",
    description:
      "Every category that currently has products, with how many each holds.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "lookup_order",
    description:
      "Status of a single order by its order number (for example BZ-1A2B3C). " +
      "Only returns an order the person asking owns — their own account's, or one placed from this browser. " +
      "Anything else comes back as not found. This tool cannot change an order.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        order_number: {
          type: "string",
          description: "The order number exactly as the person gave it.",
        },
      },
      required: ["order_number"],
      additionalProperties: false,
    },
  },
];

export function isChatToolName(name: string): name is ChatToolName {
  return CHAT_TOOLS.some((tool) => tool.name === name);
}

/**
 * Runs one tool call and returns the text handed back to the model.
 *
 * Ownership for `lookup_order` is resolved inside `lookupOrder` from the
 * request's cookies — the model's arguments never carry an identity, so it
 * cannot ask for someone else's order however it is prompted.
 *
 * Failures return a sentence rather than throwing: a tool that blows up ends
 * the conversation, whereas a tool that says "that didn't work" lets the
 * assistant apologise and offer the person a page that does work.
 */
export async function runChatTool(
  name: string,
  input: unknown,
  locale: Locale,
): Promise<string> {
  const args = (input ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "search_products": {
        const query = String(args.query ?? "").slice(0, MAX_MESSAGE_LENGTH);
        const matches = await searchProducts(query, locale, {
          categorySlug:
            typeof args.category_slug === "string" && args.category_slug
              ? args.category_slug
              : undefined,
          inStockOnly: args.in_stock_only === true,
        });

        if (matches.length === 0) {
          return `No product matches "${query}". Say so plainly and offer the catalogue at /catalog.`;
        }
        return JSON.stringify({ matches });
      }

      case "get_product": {
        const product = await getProductBySlug(String(args.slug ?? ""), locale);
        if (!product) return "No such product. It may have been withdrawn from sale.";
        return JSON.stringify({ product });
      }

      case "list_categories":
        return JSON.stringify({ categories: await listCategories(locale) });

      case "lookup_order": {
        const result = await lookupOrder(String(args.order_number ?? ""), locale);
        if (!result.found) {
          return JSON.stringify({
            found: false,
            note: "No order with that number belongs to this person. Do not speculate about why. Point them at /track.",
          });
        }
        return JSON.stringify({ order: result });
      }

      default:
        return `Unknown tool "${name}".`;
    }
  } catch (error) {
    console.error(`[chat] tool ${name} failed`, error);
    return "That lookup failed. Tell the person it didn't work and suggest they browse /catalog or use /track.";
  }
}
