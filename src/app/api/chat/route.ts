import { activeProvider, type ChatProvider } from "@/lib/chat/providers";
import { buildSystemPrompt } from "@/lib/chat/prompt";
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
import type { Locale } from "@/lib/i18n";

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
 *   1. Is any provider configured?
 *   2. Is the body a conversation?
 *   3. Has this browser (and this address) asked too often this hour?
 *   4. Is there ceiling left this month?
 *
 * Which company runs the model is decided in `@/lib/chat/providers` and does
 * not appear below this line — the gates, the ownership rules and the widget
 * are the same either way.
 */

/** Sessions are what the per-browser rate limit counts. */
const SESSION_COOKIE = "bz_chat";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function fail(code: ChatErrorCode, status: number) {
  return Response.json({ error: code }, { status });
}

export async function POST(request: Request) {
  const provider = activeProvider();
  if (!provider) return fail("unavailable", 503);

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

  const budget = await checkBudget(provider.pricing);
  if (!budget.ok) {
    console.warn(
      `[chat] monthly ceiling reached (${budget.reason}): $${budget.spentUsd.toFixed(2)} of ` +
        `$${budget.budgetUsd.toFixed(2)}, ${budget.requests} requests` +
        (budget.requestCap === null ? "" : ` of ${budget.requestCap}`),
    );
    return fail("budget_exhausted", 503);
  }

  const [locale, hasOrders] = await Promise.all([getLocale(), callerHasOrders()]);
  const system = await buildSystemPrompt(locale, { callerHasOrders: hasOrders });

  const stream = runConversation({
    provider,
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

function runConversation({
  provider,
  system,
  messages,
  locale,
  signal,
}: {
  provider: ChatProvider;
  system: string;
  messages: ClientMessage[];
  locale: Locale;
  signal: AbortSignal;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      let streamedText = false;
      let usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheWriteTokens: 0,
        cacheReadTokens: 0,
      };

      try {
        usage = await provider.run({
          system,
          messages,
          locale,
          signal,
          onEvent: (event) => {
            if (event.type === "text") streamedText = true;
            send(event);
          },
        });

        // A turn that ends with nothing visible — a refusal, a reply that was
        // all thinking, or a tool loop that ran out of turns — must not leave
        // an empty bubble on screen with no explanation.
        send(streamedText ? { type: "done" } : { type: "error", code: "failed" });
      } catch (error) {
        // An aborted request is someone closing the widget, not a fault.
        const aborted = signal.aborted || (error as { name?: string })?.name === "AbortError";
        if (!aborted) {
          console.error(`[chat] ${provider.id} conversation failed`, error);
          send({ type: "error", code: "failed" });
        }
      } finally {
        controller.close();
        // Recorded even on failure, and even when no tokens were produced: on
        // a free tier the request count is the ceiling that does the work, and
        // a failed call still consumed a slot of the shared quota.
        await recordUsage(usage);
      }
    },
  });
}
