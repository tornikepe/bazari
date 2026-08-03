import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { CHAT_TOOLS, isChatToolName, runChatTool } from "@/lib/chat/tools";
import { readKey } from "@/lib/chat/providers/key";
import {
  ProviderRateLimitError,
  isUpstreamRateLimit,
  type ChatProvider,
  type RunInput,
} from "@/lib/chat/providers/types";
import type { TokenUsage } from "@/lib/chat/pricing";

/**
 * Claude, on the Anthropic API. Paid, and the better answer.
 *
 * Used when `ANTHROPIC_API_KEY` is set. Gemini wins the default only because
 * it is free; on quality this is the one to reach for, and swapping is a
 * matter of which key exists.
 */

const MODEL = "claude-opus-5";

/**
 * `low` effort with adaptive thinking left on.
 *
 * Opus 5 thinks by default and disabling it is the more expensive lever in
 * every sense: at `disabled` the model occasionally writes a tool call into
 * its visible text — the call silently never runs, the turn looks successful,
 * and a customer gets an answer with no lookup behind it. Lower effort gets
 * the latency and cost saving without that failure mode.
 */
const EFFORT = "low";

/** Caps thinking *and* reply together on this model, so it isn't sized for
 *  the visible answer alone. */
const MAX_TOKENS = 3_000;

const MAX_TOOL_TURNS = 4;

let client: Anthropic | null = null;

function apiKey() {
  return readKey("ANTHROPIC_API_KEY");
}

export const anthropicProvider: ChatProvider = {
  id: "anthropic",
  model: MODEL,
  label: "Claude Opus 5 (Anthropic)",

  /** List prices, USD per million tokens. */
  pricing: { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },

  isConfigured() {
    return apiKey() !== undefined;
  },

  async run({ system, messages, locale, signal, onEvent }: RunInput): Promise<TokenUsage> {
    const key = apiKey();
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");

    client ??= new Anthropic({
      apiKey: key,
      // One retry, not the default two: a visitor is watching a blinking
      // cursor, and three attempts at a failing API is a very long silence.
      maxRetries: 1,
      timeout: 60_000,
    });

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

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
      const response = client.messages.stream(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          thinking: { type: "adaptive" },
          output_config: { effort: EFFORT },
          system: [
            {
              type: "text",
              text: system,
              // The shop facts and the information pages are the same bytes
              // for every visitor in a locale, so the whole prefix — tools
              // included, since they render first — is cached.
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
          onEvent({ type: "text", value: event.delta.text });
        }
      }

      let message: Anthropic.Message;
      try {
        message = await response.finalMessage();
      } catch (error) {
        // Same distinction as Gemini: being throttled is not a failure the
        // visitor caused, and it is worth a different sentence.
        if (isUpstreamRateLimit(error)) throw new ProviderRateLimitError("anthropic");
        throw error;
      }

      totals.inputTokens += message.usage.input_tokens;
      totals.outputTokens += message.usage.output_tokens;
      totals.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;
      totals.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;

      if (message.stop_reason !== "tool_use") break;

      // The assistant's turn goes back verbatim — the tool_use blocks are part
      // of it, and a tool_result without its matching tool_use is rejected.
      conversation.push({ role: "assistant", content: message.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of message.content) {
        if (block.type !== "tool_use") continue;

        if (isChatToolName(block.name)) onEvent({ type: "tool", name: block.name });
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: await runChatTool(block.name, block.input, locale),
        });
      }

      conversation.push({ role: "user", content: results });
    }

    return totals;
  },
};
