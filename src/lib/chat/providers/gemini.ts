import "server-only";

import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { CHAT_TOOLS, isChatToolName, runChatTool } from "@/lib/chat/tools";
import { readKey } from "@/lib/chat/providers/key";
import type { ChatProvider, RunInput } from "@/lib/chat/providers/types";
import type { TokenUsage } from "@/lib/chat/pricing";

/**
 * Gemini, on Google's free tier.
 *
 * Chosen as the default because it costs nothing, which for a portfolio shop
 * is the difference between a chatbot that is switched on and one that sits
 * behind a billing page. The trade is written down rather than glossed over:
 * on the free tier Google states that content is used to improve its products,
 * so the privacy page names Google as a processor and says so.
 *
 * Flash rather than Pro. The assistant answers shop questions from context
 * that is handed to it — it is not doing the reasoning that would justify a
 * larger model, and a support reply that takes eight seconds to start is worse
 * than a slightly plainer one that starts immediately.
 */

/** Free tier at the time of writing. Newer Flash releases are drop-in here. */
const MODEL = "gemini-2.5-flash";

/** Enough for the reply plus the short thinking budget below. */
const MAX_OUTPUT_TOKENS = 2_000;

/** How many tool round-trips one question may take before we stop. */
const MAX_TOOL_TURNS = 4;

/**
 * Gemini's function declarations take a raw JSON Schema under
 * `parametersJsonSchema`, so the tool definitions are reused as they are
 * rather than being translated into a second dialect that could drift out of
 * step with the Anthropic ones.
 *
 * `strict` and `input_schema` are Anthropic's spelling and are dropped here.
 */
const FUNCTION_DECLARATIONS = CHAT_TOOLS.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parametersJsonSchema: tool.input_schema,
}));

let client: GoogleGenAI | null = null;

function apiKey() {
  return readKey("GEMINI_API_KEY");
}

export const geminiProvider: ChatProvider = {
  id: "gemini",
  model: MODEL,
  label: "Gemini (Google, free tier)",

  // A free tier has no per-token price, so the money cap can never fire on it.
  // That is deliberate rather than an oversight — the ceiling that does the
  // work here is `CHAT_MONTHLY_REQUEST_CAP` plus Google's own quota. These
  // stay zero so the recorded spend is the truth and not a plausible fiction.
  pricing: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },

  isConfigured() {
    return apiKey() !== undefined;
  },

  async run({ system, messages, locale, signal, onEvent }: RunInput): Promise<TokenUsage> {
    const key = apiKey();
    if (!key) throw new Error("GEMINI_API_KEY is not set");

    client ??= new GoogleGenAI({ apiKey: key });

    const totals: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    };

    // Gemini calls the assistant "model", not "assistant".
    const contents: Content[] = messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
      const stream = await client.models.generateContentStream({
        model: MODEL,
        contents,
        config: {
          abortSignal: signal,
          systemInstruction: system,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
          // A shop question does not need deliberation, and thinking tokens
          // count against `maxOutputTokens` — spending them here would truncate
          // the answer the visitor is actually waiting for.
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const calls: { id?: string; name: string; args: Record<string, unknown> }[] = [];
      /** The model's own turn, rebuilt so it can be echoed back with the results. */
      const modelParts: Part[] = [];

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          onEvent({ type: "text", value: text });
          modelParts.push({ text });
        }

        for (const call of chunk.functionCalls ?? []) {
          if (!call.name) continue;
          calls.push({ id: call.id, name: call.name, args: call.args ?? {} });
          modelParts.push({ functionCall: call });
        }

        const usage = chunk.usageMetadata;
        if (usage) {
          // The last chunk carries the running totals for this request rather
          // than a per-chunk delta, so assign instead of adding — accumulating
          // would count the same tokens once per chunk.
          totals.inputTokens = usage.promptTokenCount ?? totals.inputTokens;
          totals.outputTokens =
            (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
          totals.cacheReadTokens = usage.cachedContentTokenCount ?? totals.cacheReadTokens;
        }
      }

      if (calls.length === 0) break;

      contents.push({ role: "model", parts: modelParts });

      const responses: Part[] = [];
      for (const call of calls) {
        if (isChatToolName(call.name)) onEvent({ type: "tool", name: call.name });

        const result = await runChatTool(call.name, call.args, locale);
        responses.push({
          functionResponse: {
            id: call.id,
            name: call.name,
            // The tool returns a string; Gemini wants an object, and naming
            // the field keeps the model from treating it as free prose.
            response: { result },
          },
        });
      }

      contents.push({ role: "user", parts: responses });
    }

    return totals;
  },
};
