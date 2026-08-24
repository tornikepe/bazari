"use server";

import { prisma } from "@/lib/prisma";
import { clientIp, consume } from "@/lib/rate-limit";
import { getLocale } from "@/lib/locale";

/**
 * Asking to be told when something is back.
 *
 * A shop that is out of stock loses the sale twice: once now, and again when
 * the box arrives and nobody knows. This is the shopper leaving an address
 * rather than being told to come back and check.
 *
 * The answer is the same whether or not the address was already on the list.
 * "You are already waiting for this" would turn the form into a way of asking
 * whether a given person wants a given product, which is nobody's business but
 * theirs.
 */

export type AlertResult = { ok: true } | { ok: false; error: "invalid" | "rate-limited" | "failed" };

export async function watchProduct(productId: string, email: string): Promise<AlertResult> {
  const address = email.trim().toLowerCase();

  // The same shape the sign-up form accepts: an `@` and something either side.
  // Anything stricter rejects real addresses, and anything this catches would
  // have bounced anyway.
  if (!address || !address.includes("@") || address.length > 200) {
    return { ok: false, error: "invalid" };
  }

  /* Per IP, because there is no account behind this. Twenty a day is far more
     products than anybody is waiting for and far fewer than a script wants. */
  const throttle = await consume(`watch:ip:${await clientIp()}`, 20, 24 * 60 * 60);
  if (!throttle.ok) return { ok: false, error: "rate-limited" };

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });
    // An unpublished product is not one a shopper can be waiting for, and
    // saying which it was would answer a question about the catalogue.
    if (!product || !product.isActive) return { ok: false, error: "invalid" };

    await prisma.stockAlert.upsert({
      where: { productId_email: { productId, email: address } },
      update: { locale: await getLocale() },
      create: { productId, email: address, locale: await getLocale() },
    });
  } catch (error) {
    console.error("watchProduct failed", error);
    return { ok: false, error: "failed" };
  }

  return { ok: true };
}
