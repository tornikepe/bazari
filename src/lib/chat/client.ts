import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * The Anthropic client, and the answer to "is the assistant switched on".
 *
 * Without a key the shop still works — the widget simply isn't rendered. The
 * chatbot is a convenience, and a missing key must never be something a
 * visitor discovers by clicking a button that then fails.
 */

/** Opus 5. Fixed here so the model can't drift between the route and a test. */
export const CHAT_MODEL = "claude-opus-5";

/**
 * `low` effort with adaptive thinking on.
 *
 * Opus 5 thinks by default and disabling it is the more expensive lever in
 * every sense: at `disabled` the model occasionally writes a tool call into
 * its visible text — the call silently never runs, the turn looks successful,
 * and a customer gets an answer with no lookup behind it. Lower effort gets
 * the latency and the cost saving without that failure mode, which for a chat
 * bubble answering shop questions is the right trade.
 */
export const CHAT_EFFORT = "low";

/**
 * Enough for the reply plus the thinking that precedes it — `max_tokens` caps
 * both together on this model, so a budget sized only for the visible answer
 * truncates it mid-sentence.
 */
export const CHAT_MAX_TOKENS = 3_000;

/** How many tool round-trips one question may take before we stop. */
export const CHAT_MAX_TOOL_TURNS = 4;

/**
 * The key, defended against the way it actually gets broken.
 *
 * A key pasted twice into a hosting dashboard arrives with a newline in the
 * middle, and every request then fails with an invalid-header error that says
 * nothing about the cause. That happened to `RESEND_API_KEY` on this project;
 * taking the first whitespace-delimited token means it can't happen twice.
 */
function readApiKey(): string | undefined {
  const raw = process.env.ANTHROPIC_API_KEY;
  if (!raw) return undefined;

  const trimmed = raw.trim();
  const first = trimmed.split(/\s+/)[0];
  if (!first) return undefined;

  if (first !== trimmed) {
    console.warn(
      "[chat] ANTHROPIC_API_KEY contained whitespace or repeated content — using the first token. Re-add it as a single line.",
    );
  }
  return first;
}

/** Whether the assistant can run at all. Read on the server, passed as a prop. */
export function isChatConfigured(): boolean {
  return readApiKey() !== undefined;
}

let client: Anthropic | null = null;

export function getChatClient(): Anthropic {
  const apiKey = readApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  client ??= new Anthropic({
    apiKey,
    // One retry, not the default two: a visitor is watching a blinking cursor,
    // and three attempts at a failing API is a very long silence.
    maxRetries: 1,
    timeout: 60_000,
  });

  return client;
}
