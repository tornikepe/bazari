/**
 * What the assistant costs, as arithmetic.
 *
 * Separate from `budget.ts` — which reads and writes the monthly counter —
 * because everything here is pure. The rates are the thing most likely to be
 * wrong in a way nobody notices, so they get to be tested without a database.
 *
 * The rates themselves live on each provider (`providers/*.ts`), because they
 * are a property of who is running the model, not of this file.
 */

import type { Pricing } from "@/lib/chat/providers/types";

/** Default money ceiling in USD. Override with `CHAT_MONTHLY_BUDGET_USD`. */
export const DEFAULT_BUDGET_USD = 5;

export function monthlyBudgetUsd(): number {
  const raw = Number(process.env.CHAT_MONTHLY_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BUDGET_USD;
}

/**
 * Optional ceiling on requests per month, unset by default.
 *
 * The money cap is the right ceiling on a paid provider and **no ceiling at
 * all on a free one** — nothing multiplied by any number of requests is still
 * nothing. This is what bounds a free tier: it stops one determined visitor
 * spreading across addresses from burning the day's quota that everyone else
 * shares. Returns `null` when unset, meaning "not enforced".
 */
export function monthlyRequestCap(): number | null {
  const raw = Number(process.env.CHAT_MONTHLY_REQUEST_CAP);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
}

/** `2026-08`. UTC so the reset moment doesn't move with the server's timezone. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
};

/**
 * Cache reads bill at a tenth of input and cache writes at 1.25×, which is why
 * the four counters are kept apart: on a conversation with a large cached
 * system prompt, treating a cache read as ordinary input overstates the bill
 * by about ten times, and the cap would fire long before the money was spent.
 */
export function costUsd(usage: TokenUsage, pricing: Pricing): number {
  return (
    (usage.inputTokens * pricing.input +
      usage.outputTokens * pricing.output +
      usage.cacheWriteTokens * pricing.cacheWrite +
      usage.cacheReadTokens * pricing.cacheRead) /
    1_000_000
  );
}
