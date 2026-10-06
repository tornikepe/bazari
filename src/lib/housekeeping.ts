import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * How long a spent row is kept before it is swept.
 *
 * A day for the rate-limit counters, because the longest window any caller
 * asks for is half an hour and a row whose window closed yesterday can never
 * change a decision again. A week for the one-time codes, which are dead the
 * moment they are used or expire but are worth keeping a little longer than
 * that — "I asked for a code and it says it was already used" is a question
 * somebody asks the next morning, and the row is the answer.
 */
const RATE_LIMIT_DAYS = 1;
const TOKEN_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;

export type SweepResult = {
  rateLimits: number;
  tokens: number;
};

/**
 * Deletes rows that have done their job.
 *
 * Both of these tables are written on every attempt at something — a sign-in,
 * a search, a coupon, a code — and neither was ever read again once its
 * moment passed. Left alone they are the two tables in the shop that grow
 * with traffic rather than with trade: a year of a busy shop is a great many
 * rows holding nothing anybody will ever look at, in a database whose size is
 * the thing the hosting bill is counted by.
 *
 * Nothing here touches what the shop is *for*. Orders, the ledger, the page
 * counts behind the analytics, the audit trail — all of those are records,
 * and a record is kept. This is the scaffolding.
 *
 * Each sweep is separate so one failing does not stop the other, and the
 * caller is told what went.
 */
export async function sweepSpentRows(): Promise<SweepResult> {
  const now = Date.now();

  const [rateLimits, tokens] = await Promise.all([
    prisma.rateLimit
      .deleteMany({ where: { windowAt: { lt: new Date(now - RATE_LIMIT_DAYS * DAY) } } })
      .then((r) => r.count)
      .catch((error) => {
        console.error("[housekeeping] rate limits", error);
        return -1;
      }),

    /* Used *or* expired — a code that was typed is as finished as one that
       timed out, and both are past the window above. */
    prisma.verificationToken
      .deleteMany({
        where: {
          createdAt: { lt: new Date(now - TOKEN_DAYS * DAY) },
          OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date(now) } }],
        },
      })
      .then((r) => r.count)
      .catch((error) => {
        console.error("[housekeeping] tokens", error);
        return -1;
      }),
  ]);

  return { rateLimits, tokens };
}
