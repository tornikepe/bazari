import { MAX_HISTORY, MAX_MESSAGE_LENGTH } from "@/lib/chat/config";

/**
 * Turning a request body into a conversation, or refusing it.
 *
 * The browser is not trusted to send a well-formed history: it is the one
 * place a caller controls the shape of what reaches the model, so anything
 * that isn't recognisably a conversation is rejected outright rather than
 * repaired into something ambiguous.
 *
 * Deliberately strict about shape and forgiving about length. An over-long
 * history is trimmed to the most recent turns instead of refused, so a long
 * conversation keeps working rather than failing at message twenty-five — and
 * the trim is what stops one session from growing an unbounded prompt.
 *
 * Lives outside `route.ts` because Next only allows HTTP-method exports from a
 * route file, and this needs to be reachable from a test.
 */

export type ClientMessage = { role: "user" | "assistant"; content: string };

export function parseMessages(body: unknown): ClientMessage[] | null {
  if (typeof body !== "object" || body === null) return null;

  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw)) return null;

  const messages: ClientMessage[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;

    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;

    const text = content.trim().slice(0, MAX_MESSAGE_LENGTH);
    // An empty assistant turn is normal — a stream that failed mid-flight
    // leaves one behind. Dropping it keeps the alternation valid.
    if (text) messages.push({ role, content: text });
  }

  const recent = messages.slice(-MAX_HISTORY);

  // The API requires the first turn to be the user's, and there is nothing to
  // answer unless the last one is too.
  while (recent.length > 0 && recent[0]!.role !== "user") recent.shift();
  if (recent.length === 0) return null;
  if (recent[recent.length - 1]!.role !== "user") return null;

  return recent;
}
