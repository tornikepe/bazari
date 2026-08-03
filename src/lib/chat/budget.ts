import "server-only";

import { prisma } from "@/lib/prisma";
import {
  costUsd,
  currentMonth,
  monthlyBudgetUsd,
  monthlyRequestCap,
  type TokenUsage,
} from "@/lib/chat/pricing";
import type { Pricing } from "@/lib/chat/providers/types";

export type { TokenUsage } from "@/lib/chat/pricing";

/**
 * The monthly ceiling.
 *
 * Rate limiting bounds how often one browser may ask; this bounds the whole
 * shop. They solve different problems, and a thousand visitors asking a single
 * question each never trips a per-browser limit.
 *
 * Two ceilings, because the right one depends on who is running the model:
 *
 * - **Money**, for a paid provider. Counted from the usage each response
 *   reports, not estimated.
 * - **Requests**, optional, for a free one — where the money cap can never
 *   fire because zero times anything is zero. This is what actually protects a
 *   free tier's shared daily quota.
 *
 * Either being reached declines the request.
 */

export type BudgetState = {
  ok: boolean;
  /** Why it was declined, for the log line. `null` when allowed. */
  reason: "money" | "requests" | "unreadable" | null;
  spentUsd: number;
  budgetUsd: number;
  requests: number;
  requestCap: number | null;
};

/**
 * Fails **closed**, unlike the rate limiter: if the counter can't be read we
 * decline. The rate limiter fails open because locking people out of the shop
 * is worse than the attack it prevents; here the failure mode is an unbounded
 * bill, so the safe direction is the other way.
 */
export async function checkBudget(pricing: Pricing): Promise<BudgetState> {
  const budgetUsd = monthlyBudgetUsd();
  const requestCap = monthlyRequestCap();

  try {
    const row = await prisma.chatUsage.findUnique({ where: { month: currentMonth() } });
    const spentUsd = row ? costUsd(row, pricing) : 0;
    const requests = row?.requests ?? 0;

    if (spentUsd >= budgetUsd) {
      return { ok: false, reason: "money", spentUsd, budgetUsd, requests, requestCap };
    }
    if (requestCap !== null && requests >= requestCap) {
      return { ok: false, reason: "requests", spentUsd, budgetUsd, requests, requestCap };
    }

    return { ok: true, reason: null, spentUsd, budgetUsd, requests, requestCap };
  } catch (error) {
    console.error("[chat] budget check failed — declining the request", error);
    return {
      ok: false,
      reason: "unreadable",
      spentUsd: budgetUsd,
      budgetUsd,
      requests: 0,
      requestCap,
    };
  }
}

/**
 * Adds one response's usage to the month.
 *
 * A single upsert, so two conversations finishing at the same moment can't
 * both read the same total and write it back — the second increment would be
 * lost, and the cap would drift below the real spend.
 *
 * Called for every request that reached the provider, **including ones that
 * produced no tokens**: on a free tier the request count is the ceiling that
 * does the work, and a failed call still consumed a slot of the daily quota.
 */
export async function recordUsage(usage: TokenUsage): Promise<void> {
  const month = currentMonth();

  try {
    await prisma.chatUsage.upsert({
      where: { month },
      create: {
        month,
        requests: 1,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        cacheReadTokens: usage.cacheReadTokens,
      },
      update: {
        requests: { increment: 1 },
        inputTokens: { increment: usage.inputTokens },
        outputTokens: { increment: usage.outputTokens },
        cacheWriteTokens: { increment: usage.cacheWriteTokens },
        cacheReadTokens: { increment: usage.cacheReadTokens },
      },
    });
  } catch (error) {
    // The answer has already been streamed; losing the accounting for one
    // reply is not worth failing the request the visitor already received.
    console.error("[chat] failed to record usage", error);
  }
}
