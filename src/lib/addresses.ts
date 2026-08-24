/**
 * Facts about the address book that are not actions.
 *
 * Here rather than beside `saveAddress`: a `"use server"` module may only
 * export async functions, so a constant living there fails the build — the
 * same rule that keeps `MAX_PHOTOS` out of the admin actions.
 */

/** As many as a person plausibly has: home, work, and two others. */
export const MAX_ADDRESSES = 8;
