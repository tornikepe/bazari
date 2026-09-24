/**
 * How many accounts a customer may keep for refunds.
 *
 * Two: a personal account and a company one is the whole of it, and a list
 * that grows without limit is a list nobody keeps tidy. Here rather than
 * in the action, so the form can say so before anything is typed —
 * a `"use server"` module may only export functions.
 */
export const MAX_REFUND_ACCOUNTS = 2;
