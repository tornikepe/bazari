"use client";

import { useEffect } from "react";
import { trackProductEvent } from "@/lib/product-events";

/**
 * Says, once, that this order's page was looked at — the last step of the
 * funnel on the dashboard, "followed the order", counted against each
 * product in it. Nothing else is sent; see `product-events.ts`.
 */
export function OrderBeacon({ productIds }: { productIds: string[] }) {
  const key = productIds.join(",");
  useEffect(() => {
    if (key) trackProductEvent("track", key.split(","));
  }, [key]);
  return null;
}
