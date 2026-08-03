import type Anthropic from "@anthropic-ai/sdk";

import {
  CHAT_EFFORT,
  CHAT_MAX_TOKENS,
  CHAT_MAX_TOOL_TURNS,
  CHAT_MODEL,
  getChatClient,
  isChatConfigured,
} from "@/lib/chat/client";
import { buildSystemPrompt } from "@/lib/chat/prompt";
import { CHAT_TOOLS, isChatToolName, runChatTool } from "@/lib/chat/tools";
import { callerHasOrders } from "@/lib/chat/order-lookup";
import { checkBudget, recordUsage, type TokenUsage } from "@/lib/chat/budget";
import {
  IP_LIMIT,
  IP_WINDOW_SECONDS,
  SESSION_LIMIT,
  SESSION_WINDOW_SECONDS,
  type ChatErrorCode,
  type ChatStreamEvent,
} from "@/lib/chat/config";
import { parseMessages, type ClientMessage } from "@/lib/chat/messages";
import { clientIp, consume } from "@/lib/rate-limit";
import { getLocale } from "@/lib/locale";

/**
 * The contact assistant.
 *
 * Streams newline-delimited JSON rather than Server-Sent Events: the widget is
 * the only consumer, `fetch` + a `ReadableStream` reader parses NDJSON in a
 * dozen lines, and it avoids the `EventSource` restriction of GET-only
 * requests. Each line is one `ChatStreamEvent`.
 *
 * Four gates stand in front of the model, in this order — cheapest first, so a
 * request that is going to be refused costs as little as possible:
 *
 *   1. Is the assistant configured at all?
 *   2. Is the body a conversation?
 *   3. Has this browser (and this address) asked too often this hour?
 *   4. Is there budget left this month?
 *
 * The loop underneath is written by hand rather than with the SDK's tool
 * runner. Both would work; this one is explicit about the two things that
 * matter here — a hard ceiling on tool round-trips, and usage accumulated
 * across every turn so the spend cap sees the true cost of one question, not
 * just the last leg of it.
 */

/** Sessions are what the per-browser rate limit counts. */
const SESSION_COOKIE = "bz_chat";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function fail(code: ChatErrorCode, status: number) {
  return Response.json({ error: code }, { status });
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  if (!isChatConfigured()) return fail("unavailable", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("bad_request", 400);
  }

  const messages = parseMessages(body);
  if (!messages) return fail("bad_request", 400);

  // A session id is only ever a rate-limit bucket — it names no person and is
  // never used to decide what anyone may read. Order access is proved by the
  // session and receipt cookies, checked inside the lookup tool.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const existingSession = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  const sessionId = existingSession || crypto.randomUUID();

  const [session, ip] = await Promise.all([
    consume(`chat:session:${sessionId}`, SESSION_LIMIT, SESSION_WINDOW_SECONDS),
    clientIp().then((address) => consume(`chat:ip:${address}`, IP_LIMIT, IP_WINDOW_SECONDS)),
  ]);

  if (!session.ok || !ip.ok) {
    const retryAfter = Math.max(session.retryAfter, ip.retryAfter);
    return Response.json(
      { error: "rate_limited" satisfies ChatErrorCode },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const budget = await checkBudget();
  if (!budget.withinBudget) {
    console.warn(
      `[chat] monthly budget reached: $${budget.spentUsd.toFixed(2)} of $${budget.budgetUsd.toFixed(2)}`,
    );
    return fail("budget_exhausted", 503);
  }

  const [locale, hasOrders] = await Promise.all([getLocale(), callerHasOrders()]);
  const system = await buildSystemPrompt(locale, { callerHasOrders: hasOrders });

  const stream = runConversation({
    system,
    messages,
    locale,
    signal: request.signal,
  });

  const headers = new Headers({
    "Content-Type": "application/x-ndjson; charset=utf-8",
    // Nothing about a conversation is cacheable, and a proxy buffering the
    // body would defeat the point of streaming it.
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  });

  if (!existingSession) {
    headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; SameSite=Lax${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`,
    );
  }

  return new Response(stream, { headers });
}

/* ------------------------------------------------------------------ */
/* The conversation loop                                               */
/* ------------------------------------------------------------------ */

function runConversation({
  system,
  messages,
  locale,
  signal,
}: {
  system: string;
  messages: ClientMessage[];
  locale: Awaited<ReturnType<typeof getLocale>>;
  signal: AbortSignal;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const client = getChatClient();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const totals: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      };

      const conversation: Anthropic.MessageParam[] = messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      let streamedText = false;

      try {
        for (let turn = 0; turn < CHAT_MAX_TOOL_TURNS; turn += 1) {
          const response = client.messages.stream(
            {
              model: CHAT_MODEL,
              max_tokens: CHAT_MAX_TOKENS,
              // Adaptive thinking at low effort. See `client.ts` for why
              // thinking is not simply switched off.
              thinking: { type: "adaptive" },
              output_config: { effort: CHAT_EFFORT },
              system: [
                {
                  type: "text",
                  text: system,
                  // The shop facts and the information pages are the same
                  // bytes for every visitor in a locale, so the whole prefix
                  // — tools included, since they render first — is cached.
                  cache_control: { type: "ephemeral" },
                },
              ],
              tools: CHAT_TOOLS,
              messages: conversation,
            },
            { signal },
          );

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta" &&
              event.delta.text
            ) {
              streamedText = true;
              send({ type: "text", value: event.delta.text });
            }
          }

          const message = await response.finalMessage();

          totals.inputTokens += message.usage.input_tokens;
          totals.outputTokens += message.usage.output_tokens;
          totals.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;
          totals.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;

          if (message.stop_reason !== "tool_use") break;

          // The assistant's turn goes back verbatim — the tool_use blocks are
          // part of it, and a tool_result without its matching tool_use is
          // rejected by the API.
          conversation.push({ role: "assistant", content: message.content });

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const block of message.content) {
            if (block.type !== "tool_use") continue;

            if (isChatToolName(block.name)) send({ type: "tool", name: block.name });
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: await runChatTool(block.name, block.input, locale),
            });
          }

          conversation.push({ role: "user", content: results });
        }

        // A turn that ends with nothing visible — a refusal, a reply that was
        // all thinking, or a tool loop that ran out of turns — must not leave
        // an empty bubble on screen with no explanation.
        if (!streamedText) {
          send({ type: "error", code: "failed" });
        } else {
          send({ type: "done" });
        }
      } catch (error) {
        // An aborted request is someone closing the widget, not a fault.
        const aborted = signal.aborted || (error as { name?: string })?.name === "AbortError";
        if (!aborted) {
          console.error("[chat] conversation failed", error);
          send({ type: "error", code: "failed" });
        }
      } finally {
        controller.close();
        // Recorded even on failure: a request that errored halfway still
        // generated tokens, and a cap that ignores them is not a cap.
        if (
          totals.inputTokens ||
          totals.outputTokens ||
          totals.cacheReadTokens ||
          totals.cacheWriteTokens
        ) {
          await recordUsage(totals);
        }
      }
    },
  });
}
