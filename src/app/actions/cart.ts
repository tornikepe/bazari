"use server";

import { getCurrentUser } from "@/lib/auth";
import { saveSnapshot } from "@/lib/abandoned-carts";

/**
 * The browser telling the server what is in its cart.
 *
 * Only for a signed-in shopper — a guest has no address to be reminded at —
 * and only ids and quantities: prices are the server's to know. Silent on
 * failure, because a cart that could not be copied is still a cart.
 */
export async function saveCartSnapshot(
  items: { productId: string; variantId?: string; quantity: number }[],
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "customer") return;
  await saveSnapshot(user.id, items).catch((error) =>
    console.error("saveCartSnapshot failed", error),
  );
}
