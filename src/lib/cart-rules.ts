/**
 * Shipping rules, shared by the client cart and the server-side order total.
 * Kept in its own module so the `placeOrder` action doesn't have to import a
 * `"use client"` file to learn what shipping costs.
 */
export const FREE_SHIPPING_THRESHOLD = 200;
export const SHIPPING_FEE = 15;
