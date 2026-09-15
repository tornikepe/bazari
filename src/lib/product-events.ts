/**
 * The steps between seeing a product and buying it, as a beacon.
 *
 * Three of them are the browser's to report: a card opened from a list, a
 * line put in the cart, and an order's page looked at after the fact. Each
 * is one small POST carrying the kind and the product ids and nothing about
 * anybody — the same route and the same rules as the page-view beacon in
 * `TrafficBeacon`, and off under the same "do not track" flag. The product
 * page's own views come from that beacon already, and the sales from the
 * orders, so those two are not sent twice.
 */
export const PRODUCT_EVENT_KINDS = ["click", "cart", "track"] as const;
export type ProductEventKind = (typeof PRODUCT_EVENT_KINDS)[number];

export function isProductEventKind(value: unknown): value is ProductEventKind {
  return typeof value === "string" && (PRODUCT_EVENT_KINDS as readonly string[]).includes(value);
}

export function trackProductEvent(kind: ProductEventKind, productIds: string[]): void {
  if (typeof navigator === "undefined" || !("sendBeacon" in navigator)) return;
  if (navigator.doNotTrack === "1") return;
  if (productIds.length === 0) return;

  navigator.sendBeacon(
    "/api/hit",
    new Blob([JSON.stringify({ event: kind, productIds })], { type: "application/json" }),
  );
}
