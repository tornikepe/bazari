import type { TokenUsage } from "@/lib/chat/pricing";
import type { ChatToolName } from "@/lib/chat/config";
import type { Locale } from "@/lib/i18n";

/**
 * The contract every model provider implements.
 *
 * Same shape as `src/lib/payments/types.ts`, and for the same reason: the
 * interesting parts of this feature — what the assistant may read, whose order
 * it may look at, what it costs — have nothing to do with which company runs
 * the model. Keeping the provider behind one interface means switching is a
 * key swap rather than a rewrite, and it means the security tests keep
 * testing the thing that matters.
 *
 * The provider owns its whole conversation loop, because the loop differs:
 * Anthropic returns `tool_use` blocks and takes `tool_result` blocks back,
 * Gemini returns `functionCall` parts and takes `functionResponse` parts. What
 * the route sees either way is a stream of `ProviderEvent` and, at the end, a
 * token count.
 */

export type ProviderId = "gemini" | "anthropic";

/**
 * The upstream model provider refused us for volume, not the visitor.
 *
 * Worth its own type because it is the difference between two very different
 * messages: "something went wrong" — which invites a pointless retry — and
 * "we're busy, try again in a moment", which is true and actionable.
 *
 * This is not a rare edge. Gemini's free tier allows **five requests a
 * minute** for the whole shop, and one question can spend two of them when a
 * tool call is involved. Three visitors asking at once is enough.
 *
 * Each adapter recognises its own SDK's shape and rethrows this, so the route
 * doesn't have to know what an Anthropic error looks like versus a Google one.
 */
export class ProviderRateLimitError extends Error {
  /** Seconds the provider asked us to wait, when it said. */
  readonly retryAfter: number | null;

  constructor(provider: ProviderId, retryAfter: number | null = null) {
    super(`${provider} rate limit reached`);
    this.name = "ProviderRateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * The key the shop was given is not one the provider will accept.
 *
 * Told apart from every other failure because it is the only one where
 * "try again" is a lie: a rejected key rejects every request until somebody
 * changes an environment variable. The visitor is told the assistant is away
 * rather than invited to retry, and the log says plainly what to fix.
 */
export class ProviderAuthError extends Error {
  constructor(provider: ProviderId) {
    super(`${provider} rejected the API key`);
    this.name = "ProviderAuthError";
  }
}

/** Whether an SDK error is an upstream 429, whichever SDK threw it. */
export function isUpstreamRateLimit(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  return status === 429;
}

/**
 * Whether an SDK error means the key was refused.
 *
 * Google answers a bad key with 400 and `API_KEY_INVALID`, Anthropic with
 * 401; a plain 400 is a malformed request and must not be mistaken for this,
 * so the 400 case has to name the reason.
 */
export function isUpstreamAuthFailure(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  if (status === 401 || status === 403) return true;
  if (status !== 400) return false;

  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && /API_KEY_INVALID|API key not valid/i.test(message);
}

/** The `retryDelay` Google returns, in whole seconds, when present. */
export function retryAfterSeconds(error: unknown): number | null {
  const message = (error as { message?: unknown })?.message;
  if (typeof message !== "string") return null;

  const match = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(message);
  if (!match) return null;

  return Math.ceil(Number(match[1]));
}

/** One turn of the conversation, as the browser sent it. */
export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ProviderEvent =
  | { type: "text"; value: string }
  /** A lookup started — the widget names it while the visitor waits. */
  | { type: "tool"; name: ChatToolName };

/** USD per million tokens. All zeros means a free tier — see `budget.ts`. */
export type Pricing = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

export type RunInput = {
  system: string;
  messages: ChatTurn[];
  locale: Locale;
  /** Aborted when the visitor closes the widget, so we stop generating. */
  signal: AbortSignal;
  onEvent: (event: ProviderEvent) => void;
};

export interface ChatProvider {
  readonly id: ProviderId;
  /** The exact model id, so a log line says which one answered. */
  readonly model: string;
  readonly pricing: Pricing;
  /** Human-readable, for the "which provider is live" log line only. */
  readonly label: string;

  /** Whether a usable key is configured for this provider. */
  isConfigured(): boolean;

  /**
   * Runs one question to completion, emitting events as it goes, and returns
   * what it consumed. Must not throw on an aborted signal — that is a visitor
   * closing the panel, not a fault.
   */
  run(input: RunInput): Promise<TokenUsage>;
}
