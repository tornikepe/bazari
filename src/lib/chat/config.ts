/**
 * Limits shared by the chat widget and the `/api/chat` route.
 *
 * No `server-only` marker here on purpose: the widget needs the same numbers
 * to disable its send button before a request is made, and a limit that the
 * two sides disagree about is a bug waiting to happen.
 */

/** One question. Long enough for a paragraph, short enough to bound cost. */
export const MAX_MESSAGE_LENGTH = 1_000;

/**
 * Turns kept in a conversation. The window slides, so a long chat keeps
 * working — it just forgets the beginning rather than growing without bound.
 */
export const MAX_HISTORY = 24;

/** Messages one browser may send per hour. */
export const SESSION_LIMIT = 30;
export const SESSION_WINDOW_SECONDS = 60 * 60;

/** A wider net for one address, in case cookies are being cleared per request. */
export const IP_LIMIT = 90;
export const IP_WINDOW_SECONDS = 60 * 60;

/** Names the NDJSON frames the route streams back. */
export type ChatStreamEvent =
  | { type: "text"; value: string }
  /** A tool started; the widget shows what the assistant is looking up. */
  | { type: "tool"; name: ChatToolName }
  | { type: "done" }
  | { type: "error"; code: ChatErrorCode };

export type ChatToolName =
  | "search_products"
  | "get_product"
  | "list_categories"
  | "lookup_order";

export type ChatErrorCode =
  /** No API key configured — the widget should not have been shown. */
  | "unavailable"
  /** Too many messages from this browser or address. */
  | "rate_limited"
  /** The month's budget is spent; resets on the 1st. */
  | "budget_exhausted"
  /** Malformed request body. */
  | "bad_request"
  /** Anything else — upstream failure, timeout. */
  | "failed";
