"use client";

import { useEffect } from "react";
import { recordView } from "@/lib/recently-viewed-store";

/**
 * Notes that this browser looked at this product.
 *
 * Renders nothing. It lives on the product page as a component rather than as
 * a call inside one, because the page is a Server Component and the list is a
 * browser's own — the server never sees it, which is also why there is nothing
 * here to send anywhere.
 */
export function RecordView({ productId }: { productId: string }) {
  useEffect(() => recordView(productId), [productId]);
  return null;
}
