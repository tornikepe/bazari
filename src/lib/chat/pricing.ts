/**
 * What the assistant costs, as arithmetic.
 *
 * Separate from `budget.ts` — which reads and writes the monthly counter —
 * because everything here is pure. The rates are the thing most likely to be
 * wrong in a way nobody notices, so they get to be tested without a database.
 */

/**
 * Claude Opus 5 list prices, USD per million tokens.
 *
 * Cache reads bill at a tenth of input and cache writes at 1.25×, which is why
 * the four counters are kept apart: on a conversation with a large cached
 * system prompt, treating a cache read as ordinary input overstates the bill
 * by about ten times, and the cap would fire long before the money was spent.
 */
export const PRICE_PER_MILLION = {
  input: 5,
  output: 25,
  cacheWrite: 6.25,
  cacheRead: 0.5,
} as const;

/** Default ceiling in USD. Override with `CHAT_MONTHLY_BUDGET_USD`. */
export const DEFAULT_BUDGET_USD = 5;

export function monthlyBudgetUsd(): number {
  const raw = Number(process.env.CHAT_MONTHLY_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_BUDGET_USD;
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

export function costUsd(usage: TokenUsage): number {
  return (
    (usage.inputTokens * PRICE_PER_MILLION.input +
      usage.outputTokens * PRICE_PER_MILLION.output +
      usage.cacheWriteTokens * PRICE_PER_MILLION.cacheWrite +
      usage.cacheReadTokens * PRICE_PER_MILLION.cacheRead) /
    1_000_000
  );
}
