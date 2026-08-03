/**
 * Shipping rules, shared by the client cart and the server-side order total.
 * Kept in its own module so the `placeOrder` action doesn't have to import a
 * `"use client"` file to learn what shipping costs.
 */
/** Tetri, like every other amount in the app. ₾200 and ₾15. */
export const FREE_SHIPPING_THRESHOLD = 20_000;
export const SHIPPING_FEE = 1_500;
