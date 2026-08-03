import "server-only";

import { geminiProvider } from "@/lib/chat/providers/gemini";
import { anthropicProvider } from "@/lib/chat/providers/anthropic";
import type { ChatProvider, ProviderId } from "@/lib/chat/providers/types";

export type * from "@/lib/chat/providers/types";

/**
 * Every provider the app knows about, in the order it prefers them.
 *
 * Gemini first because its free tier is what makes the assistant switched on
 * by default; Claude second because it is the better answer when someone is
 * willing to pay for it. Set `CHAT_PROVIDER` to override.
 *
 * Adding a third is: write the adapter, add its id to `ProviderId`, and put it
 * in this list. Nothing else changes — the route, the tools, the prompt and
 * the widget are all written against `ChatProvider`.
 */
const PROVIDERS: ChatProvider[] = [geminiProvider, anthropicProvider];

function isProviderId(value: string): value is ProviderId {
  return PROVIDERS.some((provider) => provider.id === value);
}

/**
 * The provider that will answer, or `null` when none has a key.
 *
 * An explicit `CHAT_PROVIDER` that names an unconfigured provider returns
 * `null` rather than quietly falling back to the other one: someone who wrote
 * `CHAT_PROVIDER=anthropic` and forgot the key needs to see the assistant stay
 * off, not discover months later that the free tier has been answering their
 * customers.
 */
export function activeProvider(): ChatProvider | null {
  const requested = process.env.CHAT_PROVIDER?.trim();

  if (requested) {
    if (!isProviderId(requested)) {
      console.warn(`[chat] CHAT_PROVIDER="${requested}" is not a known provider — assistant off.`);
      return null;
    }
    const chosen = PROVIDERS.find((provider) => provider.id === requested)!;
    if (!chosen.isConfigured()) {
      console.warn(`[chat] CHAT_PROVIDER="${requested}" has no API key — assistant off.`);
      return null;
    }
    return chosen;
  }

  return PROVIDERS.find((provider) => provider.isConfigured()) ?? null;
}

/** Whether the assistant can run at all. Read on the server, passed as a prop. */
export function isChatConfigured(): boolean {
  return activeProvider() !== null;
}
