import "server-only";

import { prisma } from "@/lib/prisma";
import { costUsd, currentMonth, monthlyBudgetUsd, type TokenUsage } from "@/lib/chat/pricing";

export type { TokenUsage } from "@/lib/chat/pricing";

/**
 * The monthly spend cap.
 *
 * Rate limiting bounds how often one browser may ask; this bounds what the
 * shop can be billed in total. They solve different problems, and the second
 * one is the one that shows up on a card statement: a thousand visitors asking
 * a single question each never trips a per-browser limit.
 *
 * Spend is *counted*, not estimated — every response reports the tokens it
 * actually used and those figures are what accumulate here. The rates and the
 * arithmetic live in `pricing.ts`, which has no database import and so can be
 * tested directly.
 */

export type BudgetState = { withinBudget: boolean; spentUsd: number; budgetUsd: number };

/**
 * Whether this month still has budget.
 *
 * Fails **closed**, unlike the rate limiter: if the database can't be read we
 * decline the request. The rate limiter fails open because locking people out
 * of the shop is worse than the attack it prevents; here the failure mode is
 * an unbounded bill, so the safe direction is the other way.
 */
export async function checkBudget(): Promise<BudgetState> {
  const budgetUsd = monthlyBudgetUsd();

  try {
    const row = await prisma.chatUsage.findUnique({ where: { month: currentMonth() } });
    const spentUsd = row ? costUsd(row) : 0;
    return { withinBudget: spentUsd < budgetUsd, spentUsd, budgetUsd };
  } catch (error) {
    console.error("[chat] budget check failed — declining the request", error);
    return { withinBudget: false, spentUsd: budgetUsd, budgetUsd };
  }
}

/**
 * Adds one response's usage to the month.
 *
 * A single upsert, so two conversations finishing at the same moment can't
 * both read the same total and write it back — the second increment would be
 * lost, and the cap would drift below the real spend.
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
