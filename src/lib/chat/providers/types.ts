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
